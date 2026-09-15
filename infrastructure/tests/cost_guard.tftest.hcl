# No credentials or Google API requests: all Google resources are mocked.
mock_provider "google" {}

variables {
  project_id = "offline-cost-policy-test"
  region     = "us-central1"
}

run "provisioning_is_blocked_by_default" {
  command         = plan
  expect_failures = [terraform_data.cloud_usage_guard]
}

run "environment_opt_in_is_rejected" {
  command = plan
  variables {
    allow_cloud_resources = true
  }
  expect_failures = [var.allow_cloud_resources]
}
