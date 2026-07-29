data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.root}/../backend/dist/index.js"
  output_path = "${path.root}/../backend/dist/lambda.zip"
}

resource "aws_iam_role" "lambda" {
  name = "event-ticketing-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamodb" {
  name = "event-ticketing-dynamodb"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query",
      ]
      Resource = [
        var.events_table_arn,
        var.registrations_table_arn,
        "${var.registrations_table_arn}/index/*",
      ]
    }]
  })
}

resource "aws_lambda_function" "this" {
  function_name    = var.function_name
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 29
  memory_size      = 256

  environment {
    variables = {
      EVENTS_TABLE                        = var.events_table_name
      REGISTRATIONS_TABLE                 = var.registrations_table_name
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  tags = var.tags
}
