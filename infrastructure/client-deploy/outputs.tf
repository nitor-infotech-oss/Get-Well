# ============================================================
# GetWell RhythmX — Client Deployment Outputs
# ============================================================

output "app_public_ip" {
  description = "Public IP of the application server"
  value       = aws_instance.app.public_ip
}

output "app_url" {
  description = "Application URL (HTTP)"
  value       = "http://${aws_instance.app.public_ip}"
}

output "patient_url" {
  description = "Patient room URL (example)"
  value       = "http://${aws_instance.app.public_ip}/patient/room-101"
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ${path.module}/deploy-key.pem ec2-user@${aws_instance.app.public_ip}"
}

output "ssh_private_key_path" {
  description = "Path to the SSH private key"
  value       = "${path.module}/deploy-key.pem"
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "aws_region" {
  description = "AWS Region"
  value       = var.aws_region
}

output "recording_bucket_arn" {
  description = "S3 bucket ARN for Chime Media Capture recordings"
  value       = "arn:aws:s3:::${aws_s3_bucket.recordings.id}"
}

output "recording_bucket_name" {
  description = "S3 bucket name for Chime recordings"
  value       = aws_s3_bucket.recordings.id
}

output "recording_kms_key_arn" {
  description = "KMS key ARN for S3 encryption"
  value       = aws_kms_key.recordings.arn
}

output "aws_account_id" {
  description = "AWS Account ID (for CHIME_ACCOUNT_ID in .env.prod)"
  value       = data.aws_caller_identity.current.account_id
}
