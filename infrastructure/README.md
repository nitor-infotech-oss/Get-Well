# Infrastructure — AWS Deployment Guide

## Prerequisites

1. AWS CLI configured with GovCloud credentials:
   ```bash
   aws configure --profile govcloud
   # Region: us-gov-west-1
   ```

2. Terraform >= 1.5 installed

3. Create the Terraform state bucket (one-time):
   ```bash
   aws s3 mb s3://getwell-rhythmx-terraform-state --region us-gov-west-1
   aws dynamodb create-table \
     --table-name getwell-rhythmx-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST \
     --region us-gov-west-1
   ```

## Deploy

```bash
cd infrastructure/terraform

# For local dev (us-east-1), comment out the backend block in main.tf
terraform init
terraform plan -var="db_password=YOUR_SECURE_PASSWORD" -var-file="environments/govcloud/terraform.tfvars"
terraform apply -var="db_password=YOUR_SECURE_PASSWORD" -var-file="environments/govcloud/terraform.tfvars"
```

## Outputs

After apply, Terraform outputs the key values you need for `.env`:
- `rds_endpoint` → `DB_HOST`
- `redis_endpoint` → `REDIS_HOST`
- `recording_bucket` → `CHIME_RECORDING_BUCKET`
- `recording_kms_key_arn` → `CHIME_KMS_KEY_ARN`
- `ecr_repository_url` → for Docker push
- `backend_alb_dns` → API base URL
