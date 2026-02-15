# ============================================================
# GetWell RhythmX — Terraform Variables
# ============================================================

variable "aws_region" {
  description = "AWS region (GovCloud for production)"
  type        = string
  default     = "us-gov-west-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "getwell-rhythmx"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "getwell_admin"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}
