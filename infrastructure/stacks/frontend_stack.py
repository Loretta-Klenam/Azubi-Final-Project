"""Static hosting for the React SPA: private S3 origin + CloudFront.

CDK only provisions the bucket and distribution here -- it deliberately does
NOT upload the built frontend or invalidate the cache (no
`aws_s3_deployment.BucketDeployment`). That happens as an explicit, visible
step in the GitHub Actions deploy workflow instead, so "deploy the frontend"
is a real CI/CD action you can see in workflow logs, not something hidden
inside `cdk deploy`.

Built this way (rather than making the bucket a public static website) so
the origin stays fully private and only reachable through CloudFront, using
Origin Access Control -- the current recommended pattern over the older
Origin Access Identity.
"""
from __future__ import annotations

from aws_cdk import CfnOutput, RemovalPolicy, Stack
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_s3 as s3
from constructs import Construct


class FrontendStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.site_bucket = s3.Bucket(
            self,
            "SiteBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.RETAIN,
        )

        self.distribution = cloudfront.Distribution(
            self,
            "SiteDistribution",
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(self.site_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            # A client-side router (react-router) owns paths like
            # /tickets/{id}; S3 has no matching object for those, so map its
            # 403/404 straight to index.html and let the SPA route it.
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403, response_http_status=200, response_page_path="/index.html"
                ),
                cloudfront.ErrorResponse(
                    http_status=404, response_http_status=200, response_page_path="/index.html"
                ),
            ],
        )

        # Consumed by .github/workflows/deploy.yml to sync the built
        # frontend and invalidate the CDN cache after each deploy.
        CfnOutput(self, "SiteBucketName", value=self.site_bucket.bucket_name)
        CfnOutput(self, "DistributionId", value=self.distribution.distribution_id)
