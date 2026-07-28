# Sequence Diagram

1. User opens the frontend.
2. Frontend requests event data from the API.
3. API Gateway routes the request to Lambda.
4. Lambda reads or writes event data in DynamoDB.
5. A confirmation response is returned to the user.
