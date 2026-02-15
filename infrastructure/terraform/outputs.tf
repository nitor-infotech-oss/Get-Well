# ============================================================
# GetWell RhythmX — Terraform Outputs
# ============================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "PostgreSQL RDS endpoint"
  value       = module.rds.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.redis_endpoint
}

output "recording_bucket" {
  description = "S3 bucket for Chime recordings"
  value       = module.s3.recording_bucket_name
}

output "recording_kms_key_arn" {
  description = "KMS key ARN for recording encryption"
  value       = aws_kms_key.recordings.arn
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend Docker images"
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_alb_dns" {
  description = "Backend ALB DNS name"
  value       = module.ecs.alb_dns_name
}
