# ── S3 Module ──
# Encrypted bucket for Chime media capture pipeline recordings.
# HIPAA: SSE-KMS encryption, versioning, access logging, no public access.

resource "aws_s3_bucket" "recordings" {
  bucket = "${var.project_name}-${var.environment}-recordings"

  tags = {
    Name       = "${var.project_name}-${var.environment}-recordings"
    DataClass  = "PHI-Adjacent"
    Encryption = "SSE-KMS"
  }
}

# Block ALL public access (HIPAA requirement)
resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

# Versioning for audit trail
resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle: move to Glacier after 90 days, delete after 7 years (HIPAA retention)
resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    id     = "archive-recordings"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555 # ~7 years
    }
  }
}

# Access logging
resource "aws_s3_bucket" "access_logs" {
  bucket = "${var.project_name}-${var.environment}-access-logs"
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "recordings-access-logs/"
}
