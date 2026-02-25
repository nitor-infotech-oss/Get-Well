# Infrastructure

AWS deployment resources for GetWell RhythmX.

## Directories

| Directory | Purpose |
|-----------|---------|
| **aws-poc/** | Terraform for POC: EC2, VPC, Security Group, IAM, Elastic IP. Single-instance deployment. |
| **terraform/** | AWS GovCloud (legacy). |

## POC Deployment (aws-poc)

Use this for the current demo/POC deployment:

```bash
cd aws-poc
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Outputs: `app_public_ip`, `app_url`, `patient_url`, `ssh_command`, `ssh_private_key_path`.

See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for full deployment instructions and CI/CD setup.
