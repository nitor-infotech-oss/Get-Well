# ============================================================
# GetWell RhythmX — Minimal AWS Deployment (Dev/POC)
# Region: us-east-1 (Commercial)
#
# Creates ONLY:
#   - KMS key (recording encryption at rest)
#   - S3 bucket (Chime recording storage, encrypted, private)
#   - ECR repository (Docker image registry for future ECS deploy)
#   - IAM user + policy (Chime SDK + S3 permissions for local dev)
#
# Estimated cost: < $5/month
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state for minimal setup (no S3 backend needed)
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "GetWell-RhythmX"
      Environment = "dev"
      ManagedBy   = "Terraform"
    }
  }
}

locals {
  project_name = "getwell-rhythmx"
  environment  = "dev"
  account_id   = data.aws_caller_identity.current.account_id
}

data "aws_caller_identity" "current" {}

# ── KMS Key (Encryption at rest — HIPAA requirement) ──
resource "aws_kms_key" "recordings" {
  description             = "KMS key for Chime recording S3 encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${local.project_name}-recordings-key"
  }
}

resource "aws_kms_alias" "recordings" {
  name          = "alias/${local.project_name}-recordings"
  target_key_id = aws_kms_key.recordings.key_id
}

# ── S3 Bucket (Recording Storage) ──
resource "aws_s3_bucket" "recordings" {
  bucket = "${local.project_name}-${local.environment}-recordings-${local.account_id}"

  tags = {
    Name       = "${local.project_name}-recordings"
    DataClass  = "PHI-Adjacent"
    Encryption = "SSE-KMS"
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.recordings.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ── ECR Repository (Docker image storage) ──
resource "aws_ecr_repository" "backend" {
  name                 = "${local.project_name}-backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${local.project_name}-backend"
  }
}

# ── IAM Policy for Local Development ──
# Grants Chime SDK + S3 permissions for the backend running locally
resource "aws_iam_policy" "backend_dev" {
  name        = "${local.project_name}-backend-dev-policy"
  description = "Chime SDK + S3 permissions for local backend development"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ChimeMeetings"
        Effect = "Allow"
        Action = [
          "chime:CreateMeeting",
          "chime:CreateMeetingWithAttendees",
          "chime:CreateAttendee",
          "chime:BatchCreateAttendee",
          "chime:DeleteMeeting",
          "chime:DeleteAttendee",
          "chime:GetMeeting",
          "chime:ListMeetings",
          "chime:ListAttendees"
        ]
        Resource = "*"
      },
      {
        Sid    = "ChimeMediaPipelines"
        Effect = "Allow"
        Action = [
          "chime:CreateMediaCapturePipeline",
          "chime:CreateMediaConcatenationPipeline",
          "chime:DeleteMediaCapturePipeline",
          "chime:DeleteMediaPipeline",
          "chime:GetMediaCapturePipeline",
          "chime:GetMediaPipeline",
          "chime:ListMediaCapturePipelines",
          "chime:ListMediaPipelines"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3Recordings"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = [aws_kms_key.recordings.arn]
      }
    ]
  })
}

# Attach the policy to the current user (root account)
resource "aws_iam_user_policy_attachment" "backend_dev" {
  # For root account, we skip this — root already has full access.
  # This policy is ready for when you create a dedicated IAM user.
  count      = 0
  user       = "backend-dev"
  policy_arn = aws_iam_policy.backend_dev.arn
}

# ── Outputs ──
output "recording_bucket_name" {
  description = "S3 bucket name for Chime recordings"
  value       = aws_s3_bucket.recordings.id
}

output "recording_bucket_arn" {
  description = "S3 bucket ARN for Chime recordings"
  value       = aws_s3_bucket.recordings.arn
}

output "kms_key_arn" {
  description = "KMS key ARN for recording encryption"
  value       = aws_kms_key.recordings.arn
}

output "kms_key_alias" {
  description = "KMS key alias"
  value       = aws_kms_alias.recordings.name
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend Docker images"
  value       = aws_ecr_repository.backend.repository_url
}

output "aws_account_id" {
  description = "AWS Account ID"
  value       = local.account_id
}

output "aws_region" {
  description = "AWS Region"
  value       = "us-east-1"
}
