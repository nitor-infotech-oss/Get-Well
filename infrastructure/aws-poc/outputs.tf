# ============================================================
# GetWell RhythmX — POC Outputs
# ============================================================

output "app_public_ip" {
  description = "Public IP of the application server"
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Application URL"
  value       = "http://${aws_eip.app.public_ip}"
}

output "patient_url" {
  description = "Patient room URL (example)"
  value       = "http://${aws_eip.app.public_ip}/patient/room-101"
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ${path.module}/deploy-key.pem ec2-user@${aws_eip.app.public_ip}"
}

output "ssh_private_key_path" {
  description = "Path to the SSH private key"
  value       = "${path.module}/deploy-key.pem"
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}
