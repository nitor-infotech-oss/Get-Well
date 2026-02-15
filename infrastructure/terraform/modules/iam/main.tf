# ── IAM Module ──
# Least-privilege roles for ECS tasks and Chime SDK access.

# ── ECS Task Execution Role (pulls images, writes logs) ──
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws-us-gov:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow pulling secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ]
      Resource = "*"
    }]
  })
}

# ── ECS Task Role (application-level permissions) ──
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# Chime SDK permissions (meetings, attendees, media pipelines)
resource "aws_iam_role_policy" "chime_sdk" {
  name = "chime-sdk-access"
  role = aws_iam_role.ecs_task.id

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
      }
    ]
  })
}

# S3 access for recordings
resource "aws_iam_role_policy" "s3_recordings" {
  name = "s3-recordings-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        var.recording_bucket_arn,
        "${var.recording_bucket_arn}/*"
      ]
    }]
  })
}

# CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch" {
  name = "cloudwatch-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "*"
    }]
  })
}
