import json
import boto3
import os
from datetime import datetime

# Add the new client for RAG
bedrock_runtime = boto3.client('bedrock-runtime')
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    
    try:
        # Get the API Gateway management API endpoint
        domain_name = event['requestContext']['domainName']
        stage = event['requestContext']['stage']
        endpoint_url = f"https://{domain_name}/{stage}"
        
        apigateway = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint_url)
        
        # Parse the incoming message
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', 'Hello!')
        
        print(f"Received message from {connection_id}: {user_message}")
        
        # Call RAG instead of direct Bedrock
        assistant_message, sources = call_bedrock_rag(user_message)
        
        print(f"RAG response: {assistant_message[:100]}...")
        
        # Prepare response for client (updated to include sources)
        response_data = {
            'type': 'rag_response',
            'message': assistant_message,
            'sources': sources,
            'model': f"{os.environ['BEDROCK_MODEL_ID']}-rag",
            'timestamp': int(datetime.utcnow().timestamp() * 1000)
        }
        
        # Send response back to client
        apigateway.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(response_data)
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Message processed with RAG'})
        }
        
    except Exception as e:
        print(f"Error processing message for connection {connection_id}: {str(e)}")
        
        # Send error message to client
        try:
            error_response = {
                'type': 'error',
                'message': f'Sorry, I encountered an error: {str(e)}',
                'timestamp': int(datetime.utcnow().timestamp() * 1000)
            }
            
            apigateway.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(error_response)
            )
        except:
            pass  # Connection might be closed
        
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Failed to process message'})
        }

def call_bedrock_rag(message):
    """Call Bedrock RAG with Knowledge Base"""
    try:
        # Get Knowledge Base ID from environment variable
        knowledge_base_id = os.environ.get('KNOWLEDGE_BASE_ID')
        
        if not knowledge_base_id:
            # Fallback to regular Bedrock if no KB configured
            return call_fallback_bedrock(message), []
        
        # Call retrieve and generate
        response = bedrock_agent_runtime.retrieve_and_generate(
            input={
                'text': message
            },
            retrieveAndGenerateConfiguration={
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': {
                    'knowledgeBaseId': knowledge_base_id,
                    'modelArn': f'arn:aws:bedrock:us-west-2::foundation-model/{os.environ["BEDROCK_MODEL_ID"]}',
                    'retrievalConfiguration': {
                        'vectorSearchConfiguration': {
                            'numberOfResults': 3  # Top 3 most relevant articles
                        }
                    }
                }
            }
        )
        
        # Extract response and sources
        answer = response['output']['text']
        
        # Extract source information if available
        sources = []
        if 'citations' in response:
            for citation in response['citations']:
                for reference in citation.get('retrievedReferences', []):
                    metadata = reference.get('metadata', {})
                    sources.append({
                        'id': metadata.get('id', 'Unknown'),
                        'title': metadata.get('title', 'Knowledge Article'),
                        'category': metadata.get('category', 'Support')
                    })
        
        return answer, sources
        
    except Exception as e:
        print(f"RAG error: {str(e)}")
        # Fallback to regular Bedrock
        return call_fallback_bedrock(message), []

def call_fallback_bedrock(message):
    """Fallback to regular Bedrock if RAG fails"""
    try:
        bedrock_request = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "temperature": 0.7,
            "system": "You are a helpful customer service assistant for a financial institution. If you don't have specific information, politely direct customers to contact support.",
            "messages": [
                {
                    "role": "user",
                    "content": message
                }
            ]
        }
        
        response = bedrock_runtime.invoke_model(
            modelId=os.environ['BEDROCK_MODEL_ID'],
            contentType='application/json',
            accept='application/json',
            body=json.dumps(bedrock_request)
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']
        
    except Exception as e:
        print(f"Fallback Bedrock error: {str(e)}")
        return "I'm sorry, I'm experiencing technical difficulties. Please contact customer support for assistance."