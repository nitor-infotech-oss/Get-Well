# ============================================================
# GetWell RhythmX Virtual Care — Root Terraform Configuration
# Target: AWS GovCloud (FedRAMP Moderate)
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 (create this bucket manually first)
  backend "s3" {
    bucket         = "getwell-rhythmx-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-gov-west-1"
    encrypt        = true
    dynamodb_table = "getwell-rhythmx-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "GetWell-RhythmX"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA-FedRAMP-Moderate"
    }
  }
}

# ── VPC ──
module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
}

# ── IAM Roles & Policies ──
module "iam" {
  source = "./modules/iam"

  project_name    = var.project_name
  environment     = var.environment
  recording_bucket_arn = module.s3.recording_bucket_arn
}

# ── S3 Buckets (Recording Storage) ──
module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  kms_key_arn  = aws_kms_key.recordings.arn
}

# ── RDS PostgreSQL ──
module "rds" {
  source = "./modules/rds"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_username        = var.db_username
  db_password        = var.db_password
  kms_key_arn        = aws_kms_key.database.arn
}

# ── ElastiCache Redis ──
module "elasticache" {
  source = "./modules/elasticache"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
}

# ── ECS Fargate (Backend Service) ──
module "ecs" {
  source = "./modules/ecs"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  ecr_repository_url = aws_ecr_repository.backend.repository_url
  task_role_arn      = module.iam.ecs_task_role_arn
  execution_role_arn = module.iam.ecs_execution_role_arn
  redis_endpoint     = module.elasticache.redis_endpoint
  rds_endpoint       = module.rds.endpoint
  container_port     = 3000
}

# ── KMS Keys (Encryption at rest — HIPAA requirement) ──
resource "aws_kms_key" "recordings" {
  description             = "KMS key for Chime recording S3 encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-recordings-key"
  }
}

resource "aws_kms_alias" "recordings" {
  name          = "alias/${var.project_name}-recordings"
  target_key_id = aws_kms_key.recordings.key_id
}

resource "aws_kms_key" "database" {
  description             = "KMS key for RDS encryption at rest"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${var.project_name}-database-key"
  }
}

resource "aws_kms_alias" "database" {
  name          = "alias/${var.project_name}-database"
  target_key_id = aws_kms_key.database.key_id
}

# ── ECR Repository ──
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = {
    Name = "${var.project_name}-backend"
  }
}
