locals {
  routes = {
    health_get = {
      resource_id = aws_api_gateway_resource.health.id
      http_method = "GET"
    }
    events_get = {
      resource_id = aws_api_gateway_resource.events.id
      http_method = "GET"
    }
    events_post = {
      resource_id = aws_api_gateway_resource.events.id
      http_method = "POST"
    }
    event_get = {
      resource_id = aws_api_gateway_resource.event_id.id
      http_method = "GET"
    }
    event_put = {
      resource_id = aws_api_gateway_resource.event_id.id
      http_method = "PUT"
    }
    event_delete = {
      resource_id = aws_api_gateway_resource.event_id.id
      http_method = "DELETE"
    }
    registrations_post = {
      resource_id = aws_api_gateway_resource.registrations.id
      http_method = "POST"
    }
    registrations_get = {
      resource_id = aws_api_gateway_resource.registrations.id
      http_method = "GET"
    }
  }
}

resource "aws_api_gateway_rest_api" "this" {
  name        = var.api_name
  description = "Event Registration and Ticketing API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.tags
}

# ── Resources ──────────────────────────────────────────────

resource "aws_api_gateway_resource" "health" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "health"
}

resource "aws_api_gateway_resource" "events" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "events"
}

resource "aws_api_gateway_resource" "event_id" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.events.id
  path_part   = "{id}"
}

resource "aws_api_gateway_resource" "registrations" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.event_id.id
  path_part   = "registrations"
}

# ── Methods + Lambda proxy integrations ────────────────────

resource "aws_api_gateway_method" "method" {
  for_each      = local.routes
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = each.value.resource_id
  http_method   = each.value.http_method
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration" {
  for_each                = local.routes
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = each.value.resource_id
  http_method             = each.value.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn
}

# ── CORS OPTIONS methods ────────────────────────────────────

locals {
  cors_resources = {
    events        = aws_api_gateway_resource.events.id
    event_id      = aws_api_gateway_resource.event_id.id
    registrations = aws_api_gateway_resource.registrations.id
    health        = aws_api_gateway_resource.health.id
  }
}

resource "aws_api_gateway_method" "options" {
  for_each      = local.cors_resources
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = each.value
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  for_each    = local.cors_resources
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = each.value
  http_method = "OPTIONS"
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({ statusCode = 204 })
  }
}

resource "aws_api_gateway_method_response" "options" {
  for_each    = local.cors_resources
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = each.value
  http_method = "OPTIONS"
  status_code = "204"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  for_each    = local.cors_resources
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = each.value
  http_method = "OPTIONS"
  status_code = "204"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options]
}

# ── Lambda permission ────────────────────────────────────────

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*"
}

# ── Deployment + Stage ──────────────────────────────────────

resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.this.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.events.id,
      aws_api_gateway_resource.event_id.id,
      aws_api_gateway_resource.registrations.id,
      aws_api_gateway_resource.health.id,
      aws_api_gateway_method.method,
      aws_api_gateway_integration.integration,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.integration,
    aws_api_gateway_integration.options,
  ]
}

resource "aws_api_gateway_stage" "this" {
  deployment_id = aws_api_gateway_deployment.this.id
  rest_api_id   = aws_api_gateway_rest_api.this.id
  stage_name    = "api"

  tags = var.tags
}
