output "recording_bucket_arn" {
  value = aws_s3_bucket.recordings.arn
}

output "recording_bucket_name" {
  value = aws_s3_bucket.recordings.id
}
