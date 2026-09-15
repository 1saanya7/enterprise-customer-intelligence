terraform {
  required_version = ">= 1.6, < 2.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
  }
}

variable "project_id" {
  type        = string
  description = "Existing billing-enabled project; this module does not create a project."
}

variable "allow_cloud_resources" {
  type        = bool
  default     = false
  description = "Keep false under the user's no-paid-cloud policy. A future change requires explicit user approval."
  validation {
    condition     = !var.allow_cloud_resources
    error_message = "Cloud resources are forbidden by the current no-paid-cloud policy. Do not enable billing or deploy."
  }
}

resource "terraform_data" "cloud_usage_guard" {
  lifecycle {
    precondition {
      condition     = var.allow_cloud_resources
      error_message = "Cloud provisioning is disabled. Local development only; no cloud spending is authorized."
    }
  }
}

variable "region" {
  type        = string
  description = "Choose after checking model, runtime, and data residency requirements."
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "services" {
  depends_on = [terraform_data.cloud_usage_guard]
  for_each = toset([
    "aiplatform.googleapis.com", "bigquery.googleapis.com", "run.googleapis.com",
    "artifactregistry.googleapis.com", "secretmanager.googleapis.com",
    "logging.googleapis.com", "monitoring.googleapis.com",
    "iam.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "tools" {
  account_id   = "customer-intelligence-tools"
  display_name = "Customer intelligence tool service"
  depends_on   = [google_project_service.services]
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id                 = "customer_intelligence"
  location                   = var.region
  delete_contents_on_destroy = false
  depends_on                 = [google_project_service.services]
}

resource "google_bigquery_table" "sales" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "sales"
  deletion_protection = true
  clustering          = ["tenant_id", "product_id"]
  time_partitioning {
    type  = "DAY"
    field = "order_date"
  }
  schema = jsonencode([
    { name = "tenant_id", type = "STRING", mode = "REQUIRED" },
    { name = "product_id", type = "STRING", mode = "REQUIRED" },
    { name = "product", type = "STRING", mode = "REQUIRED" },
    { name = "order_date", type = "DATE", mode = "REQUIRED" },
    { name = "category", type = "STRING", mode = "REQUIRED" },
    { name = "region", type = "STRING", mode = "REQUIRED" },
    { name = "city", type = "STRING", mode = "REQUIRED" },
    { name = "revenue_paise", type = "INTEGER", mode = "REQUIRED" },
    { name = "units", type = "INTEGER", mode = "REQUIRED" },
  ])
}

# Dataset-scoped reads; no project-wide warehouse viewer grant.
resource "google_bigquery_dataset_iam_member" "tool_reader" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.tools.email}"
}

resource "google_project_iam_member" "query_jobs" {
  depends_on = [terraform_data.cloud_usage_guard]
  project    = var.project_id
  role       = "roles/bigquery.jobUser"
  member     = "serviceAccount:${google_service_account.tools.email}"
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "customer-intelligence"
  format        = "DOCKER"
  depends_on    = [google_project_service.services]
}

output "tool_service_account" {
  value = google_service_account.tools.email
}

output "sales_table" {
  value = "${var.project_id}.${google_bigquery_dataset.analytics.dataset_id}.${google_bigquery_table.sales.table_id}"
}
