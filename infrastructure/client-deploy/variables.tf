# ============================================================
# GetWell RhythmX — Client Deployment Variables
# Region: ap-south-1 (Mumbai) for India
# ============================================================

variable "aws_region" {
  description = "AWS region — Mumbai for India"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "getwell-rhythmx-client"
}

variable "instance_type" {
  description = "EC2 instance type (t3.small for POC)"
  type        = string
  default     = "t3.small"
}
