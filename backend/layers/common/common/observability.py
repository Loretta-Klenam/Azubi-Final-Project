"""Shared Powertools singletons.

Instantiated once per module import (Powertools relies on module-level
singletons so state -- like buffered EMF metrics -- survives across a warm
Lambda invocation but resets per cold start). Every handler imports these
instead of constructing its own Logger/Tracer/Metrics, so log format and
metric namespace stay consistent across all ten functions.
"""
from aws_lambda_powertools import Logger, Metrics, Tracer

SERVICE_NAME = "event-ticketing"
METRICS_NAMESPACE = "EventTicketing"

logger = Logger(service=SERVICE_NAME)
tracer = Tracer(service=SERVICE_NAME)
metrics = Metrics(namespace=METRICS_NAMESPACE, service=SERVICE_NAME)
