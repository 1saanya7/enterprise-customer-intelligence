# Cloud foundation — not applied

**Provisioning is blocked by the user's no-paid-cloud policy.** `terraform_data.cloud_usage_guard` fails planning under the default configuration; setting `allow_cloud_resources=true` is also rejected by variable validation. Enabling cloud resources requires an explicit code/policy change with new user authorization. Do not run a live plan/apply under the current requirement. Formatting, validation and mocked offline tests remain allowed.

This guarded module defines APIs, a tool service account, a scoped analytics dataset, the INR sales schema, and a container repository. It does not deploy the application, register an agent, establish end-user identity, enforce per-user warehouse row policies, or configure enterprise networking.

The tool service account can read this dataset. The adapter applies tenant scope; a production design must also resolve the required warehouse isolation model. Do not attach this identity to arbitrary model-generated SQL execution.

If the user later authorizes a revised spending policy, inspect a concrete `terraform plan` before applying. Application deployment also requires real token verification and private/authenticated tool invocation. Terraform state must move to a restricted remote backend before shared use.

Docker Desktop is not required for local development. We plan to build deployment containers using Cloud Build; its service account and build permissions will be added with CI/CD.

Local `terraform validate` passed with Google provider 7.46.1. Because the registry hostname did not resolve on this machine, `scripts/install-terraform-provider.ps1` downloaded the official release archive and verified its published SHA256 before installing it through a local mirror. Terraform's lock currently contains the Windows platform checksum only. Add the deployment/CI platform with `terraform providers lock -platform=linux_amd64` when registry access is available; do not remove the lock to work around checksum errors.

```powershell
./scripts/cloud-shell.ps1
terraform -chdir=infrastructure init
terraform -chdir=infrastructure validate
# Supply project_id and region explicitly when planning; no defaults select a billed project.
```
