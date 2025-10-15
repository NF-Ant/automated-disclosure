# Salesforce AI Chat with AWS Bedrock RAG - Knowledge Transfer Document

## Table of Contents
1. [Overview](#overview)
2. Test search directly:
   ```python
   response = bedrock_agent_runtime.retrieve(
       knowledgeBaseId='<YOUR_KB_ID>',
       retrievalQuery={'text': 'test query'}
   )
   ```. [Architecture](#architecture)
3. [Components](#components)
4. [Data Flow](#data-flow)
5. [Setup & Configuration](#setup--configuration)
6. [Known Issues & Workarounds](#known-issues--workarounds)
7. [Troubleshooting](#troubleshooting)
8. [Future Enhancements](#future-enhancements)

---

## Overview

This application provides an AI-powered chat interface embedded in Salesforce that leverages AWS Bedrock's Claude models with Retrieval-Augmented Generation (RAG). The system enables real-time conversational AI that answers questions based on Salesforce Knowledge Articles, providing contextually relevant responses with source citations.

### Key Features
- **Real-time Chat**: WebSocket-based communication for instant responses
- **RAG-Enhanced AI**: Answers grounded in Salesforce Knowledge Articles
- **Session Persistence**: Maintains conversation context across multiple messages
- **Source Citations**: References specific knowledge articles used in responses
- **Multi-Model Support**: Configurable Claude models (Sonnet, Opus, Haiku)
- **Automatic Knowledge Sync**: Salesforce articles automatically synced to AWS

### Technology Stack
- **Frontend**: Salesforce Lightning Web Component (LWC)
- **Backend**: AWS Lambda (Python 3.11)
- **AI/ML**: Amazon Bedrock (Claude models)
- **Vector Store**: Amazon OpenSearch Serverless
- **Real-time Communication**: AWS API Gateway WebSocket
- **Storage**: Amazon S3, DynamoDB
- **Embeddings**: Amazon Titan Text Embeddings v2

---

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph Salesforce["Salesforce Environment"]
        UI[Lightning Web Component<br/>Chat Interface]
        KA[Knowledge Articles]
        Handler[Apex Handler<br/>KnowledgeToS3Handler]
        Queueable[Queueable Job<br/>KnowledgeToS3Queueable]
    end
    
    subgraph AWS["AWS Cloud"]
        subgraph API["API Gateway"]
            WS[WebSocket API<br/>wss://YOUR-API-ID...]
        end
        
        subgraph Lambda["Lambda Functions"]
            Connect[Connect Handler]
            Disconnect[Disconnect Handler]
            Chat[Chat Handler<br/>with RAG]
            Sync[Knowledge Sync<br/>Lambda]
        end
        
        subgraph Storage["Storage Layer"]
            S3[S3 Bucket<br/>YOUR-KB-BUCKET]
            DDB[(DynamoDB<br/>Connections & Sessions)]
        end
        
        subgraph Bedrock["Amazon Bedrock"]
            KB[Knowledge Base<br/>ID: YOUR-KB-ID]
            Claude[Claude Models<br/>Sonnet/Opus/Haiku]
            OSS[(OpenSearch Serverless<br/>Vector Store)]
            Embed[Titan Embeddings v2<br/>1024 dimensions]
        end
    end
    
    UI -->|WebSocket| WS
    WS --> Connect
    WS --> Disconnect
    WS --> Chat
    
    Connect --> DDB
    Disconnect --> DDB
    Chat --> DDB
    Chat -->|Retrieve & Generate| KB
    KB --> OSS
    KB --> Claude
    KB --> Embed
    
    KA -->|Trigger/Manual| Handler
    Handler --> Queueable
    Queueable -->|HTTPS POST| Sync
    Sync --> S3
    S3 -->|Data Source| KB
    
    style Salesforce fill:#00a1e0
    style AWS fill:#ff9900
    style Bedrock fill:#8b5cf6
```

### WebSocket Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant LWC as Salesforce LWC
    participant WS as WebSocket API
    participant Connect as Connect Lambda
    participant Disconnect as Disconnect Lambda
    participant Chat as Chat Lambda
    participant DDB as DynamoDB
    participant KB as Knowledge Base
    participant Claude as Claude Model
    
    User->>LWC: Opens Chat Interface
    LWC->>WS: Connect Request
    WS->>Connect: $connect event
    Connect->>DDB: Store connectionId + TTL (2 hours)
    DDB-->>Connect: Confirmation
    Connect-->>WS: 200 OK
    WS-->>LWC: Connection Established
    LWC-->>User: Shows "Connected" status
    
    User->>LWC: Types message
    LWC->>WS: Send message via WebSocket
    WS->>Chat: $default route
    Chat->>DDB: Get bedrockSessionId
    DDB-->>Chat: Return session (or null)
    Chat->>KB: retrieve_and_generate(message, sessionId)
    KB->>Claude: Generate with context
    Claude-->>KB: Response
    KB-->>Chat: Answer + Sources + SessionId
    Chat->>DDB: Update bedrockSessionId
    DDB-->>Chat: Confirmation
    Chat->>WS: Send response
    WS->>LWC: Deliver message
    LWC-->>User: Display AI response
    
    User->>LWC: Closes chat/navigates away
    LWC->>WS: Disconnect Request
    WS->>Disconnect: $disconnect event
    Disconnect->>DDB: Delete connectionId
    DDB-->>Disconnect: Confirmation
    Disconnect-->>WS: 200 OK
```

### Knowledge Article Sync Flow

```mermaid
sequenceDiagram
    participant SF as Salesforce Knowledge
    participant Handler as Apex Handler
    participant Queue as Queueable Job
    participant Lambda as Sync Lambda
    participant S3 as S3 Bucket
    participant KB as Bedrock KB
    participant OSS as OpenSearch
    
    Note over SF: Article Created/Updated
    SF->>Handler: Trigger fires (save event)
    Handler->>Queue: Enqueue article IDs
    
    Queue->>SF: Query published articles
    SF-->>Queue: Return online versions
    
    Queue->>Lambda: HTTP POST with article data
    Lambda->>Lambda: Clean HTML/Rich text
    Lambda->>Lambda: Format as JSON
    Lambda->>S3: Upload article JSON
    S3-->>Lambda: Confirm upload
    
    Lambda->>KB: Start ingestion job
    KB->>S3: Read new/updated files
    KB->>OSS: Generate embeddings
    KB->>OSS: Store vectors
    OSS-->>KB: Confirm indexed
    KB-->>Lambda: Ingestion job ID
    Lambda-->>Queue: Success response
    
    Note over KB,OSS: KB ready for queries
```

---

## Components

### 1. Salesforce Components

#### Lightning Web Component (LWC)
**File**: `aiChatInterface.js`, `aiChatInterface.html`, `aiChatInterface.css`

**Purpose**: Provides the user interface for the chat experience

**Key Features**:
- WebSocket connection management
- Real-time message display
- Typing indicators
- Error handling
- Auto-resizing input
- Message history display
- Source citation display

**Configuration**:
```javascript
wsUrl = 'wss://op0nesemea.execute-api.us-west-2.amazonaws.com/dev';
```

**Available in**:
- App Pages
- Home Pages
- Record Pages
- Tabs
- Utility Bar
- Communities

#### Apex Handler
**File**: `KnowledgeToS3Handler.cls`

**Purpose**: Processes Knowledge Articles and sends them to AWS Lambda

**Key Methods**:
- `processArticles(List<Id>)`: Future method for async processing
- `buildArticleJson()`: Formats article data as JSON
- `sendToLambda()`: Makes HTTP callout to Lambda
- `logError()`: Error tracking

**Named Credential**: `AWS_Lambda_S3_Sync`

#### Queueable Job
**File**: `KnowledgeToS3Queueable.cls`

**Purpose**: Handles batch processing of knowledge articles

**Why Queueable?**:
- Allows callouts (HTTP to Lambda)
- Better for governor limit management
- Can be chained for large batches
- More reliable than future methods for batch operations

### 2. AWS Lambda Functions

#### Connect Handler
**CloudFormation Resource**: `ConnectFunction`

**Purpose**: Handles WebSocket connection establishment

**Actions**:
- Stores connection ID in DynamoDB
- Sets TTL (2 hours) for auto-cleanup
- Returns success/failure status

#### Disconnect Handler
**CloudFormation Resource**: `DisconnectFunction`

**Purpose**: Cleans up closed connections

**Actions**:
- Removes connection ID from DynamoDB
- Logs disconnection event

#### Chat Handler (RAG-Enabled)
**CloudFormation Resource**: `DefaultFunction`

**File**: Updated Lambda code provided

**Purpose**: Main chat processing with RAG capabilities

**Key Functions**:
- `lambda_handler()`: Main entry point
- `get_bedrock_session_id()`: Retrieves existing session
- `store_bedrock_session_id()`: Persists session ID
- `call_bedrock_rag_with_session()`: RAG query with context
- `call_fallback_bedrock()`: Fallback without KB

**Environment Variables**:
```python
TABLE_NAME: websocket-connections-<ENVIRONMENT>
BEDROCK_MODEL_ID: anthropic.claude-3-5-sonnet-20241022-v2:0
KNOWLEDGE_BASE_ID: <YOUR_KB_ID>
```

**RAG Configuration**:
- Number of results: 3 (top 3 most relevant articles)
- Session-based conversation context
- Automatic fallback if KB unavailable

#### Knowledge Sync Lambda
**CloudFormation Resource**: `SalesforceKnowledgeSyncFunction`

**Purpose**: Receives articles from Salesforce and syncs to S3

**Key Functions**:
- `process_article()`: Cleans and structures data
- `clean_rich_text()`: HTML to markdown conversion
- `upload_to_s3()`: Stores JSON in S3
- `sync_knowledge_base()`: Triggers KB ingestion

**Lambda Function URL**: Public endpoint for Salesforce callouts

### 3. AWS Infrastructure

#### DynamoDB Table
**Name**: `websocket-connections-<ENVIRONMENT>`

**Schema**:
```
Primary Key: connectionId (String)
GSI: userId-index (for future user tracking)
Attributes:
  - connectionId
  - userId (optional)
  - connectedAt (timestamp)
  - bedrockSessionId (for conversation context)
  - ttl (auto-deletion after 2 hours)
```

#### S3 Bucket
**Name**: `<YOUR_ORGANIZATION>-kb-knowledge-articles`

**Structure**:
```
s3://<YOUR_ORGANIZATION>-kb-knowledge-articles/
  ├── kb-<ArticleNumber>.json
  ├── kb-<ArticleNumber>.json
  └── ...
```

**File Format**:
```json
{
  "id": "kb-000001",
  "title": "Article Title",
  "topic": "Knowledge Base",
  "category": "Customer Support",
  "content": "Cleaned article content...",
  "metadata": {
    "author": "John Doe",
    "last_updated": "2025-09-03",
    "region": "US",
    "importance": "Medium",
    "source": "Salesforce Knowledge"
  },
  "related_articles": []
}
```

#### Bedrock Knowledge Base
**Name**: `<YOUR_ORGANIZATION>-knowledge-base`
**ID**: `<YOUR_KB_ID>`

**Configuration**:
- **Vector Store**: Amazon OpenSearch Serverless
- **Collection ARN**: `arn:aws:aoss:<REGION>:<ACCOUNT_ID>:collection/<COLLECTION_ID>`
- **Embeddings Model**: Titan Text Embeddings v2
- **Embedding Type**: Float vector embeddings
- **Vector Dimensions**: 1024
- **Chunking Strategy**: Default
- **Parsing Strategy**: Default

**Vector Store Indexes**:
- Vector Index: `bedrock-knowledge-base-default-index`
- Vector Field: `bedrock-knowledge-base-default-vector`
- Text Field: `AMAZON_BEDROCK_TEXT`
- Metadata Field: `AMAZON_BEDROCK_METADATA`

**Data Source**:
- Type: S3
- Bucket: `s3://<YOUR_ORGANIZATION>-kb-knowledge-articles`
- Status: Available
- Data Deletion Policy: Delete

---

## Data Flow

### User Query Processing

```mermaid
flowchart TD
    A[User sends message] --> B{WebSocket connected?}
    B -->|No| C[Show error]
    B -->|Yes| D[Send to Chat Lambda]
    
    D --> E{Session exists in DDB?}
    E -->|Yes| F[Load session ID]
    E -->|No| G[Create new session]
    
    F --> H[Call KB with session]
    G --> H
    
    H --> I[KB searches vector store]
    I --> J[Retrieve top 3 articles]
    J --> K[Claude generates response]
    K --> L{Response successful?}
    
    L -->|Yes| M[Store new session ID]
    L -->|No| N[Fallback to basic Claude]
    
    M --> O[Return response + sources]
    N --> O
    
    O --> P[Send to user via WebSocket]
    P --> Q[Display in chat UI]
```

### Knowledge Article Ingestion

```mermaid
flowchart TD
    A[Article saved in SF] --> B{Trigger fires?}
    B -->|Sometimes| C[Handler processes]
    B -->|Publish/Archive| D[⚠️ Trigger doesn't fire]
    
    C --> E[Queueable job enqueued]
    E --> F[Query online versions]
    F --> G[Build JSON payload]
    G --> H[HTTP POST to Lambda]
    
    H --> I[Clean HTML content]
    I --> J[Upload JSON to S3]
    J --> K[Start KB ingestion]
    
    K --> L[KB reads S3 files]
    L --> M[Generate embeddings]
    M --> N[Store in OpenSearch]
    N --> O[KB available for queries]
    
    D --> P[Manual sync required]
    P --> G
```

---

## Setup & Configuration

### Prerequisites
- AWS Account with Bedrock access
- Salesforce org with Knowledge enabled
- AWS CLI configured
- Salesforce CLI (optional, for deployment)
- System Administrator access in Salesforce

### Required Salesforce Permissions
- **Setup Access**: Required for configuration
- **CSP Trusted Sites**: Required for WebSocket connections
- **Remote Site Settings**: Required for Lambda callouts
- **Named Credentials**: Required for secure API connections

### Step 1: Deploy AWS Infrastructure

```bash
# Deploy WebSocket Chat API
aws cloudformation create-stack \
  --stack-name salesforce-chat-websocket \
  --template-body file://websocket-chat-template.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=dev \
    ParameterKey=BedrockModelId,ParameterValue=anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy Knowledge Sync Lambda
aws cloudformation create-stack \
  --stack-name salesforce-knowledge-sync \
  --template-body file://knowledge-sync-template.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=<ENVIRONMENT> \
    ParameterKey=S3BucketName,ParameterValue=<YOUR_ORGANIZATION>-kb-knowledge-articles \
    ParameterKey=KnowledgeBaseId,ParameterValue=<YOUR_KB_ID> \
    ParameterKey=DataSourceId,ParameterValue=<YOUR_DATA_SOURCE_ID> \
  --capabilities CAPABILITY_NAMED_IAM
```

### Step 2: Create S3 Bucket

```bash
aws s3 mb s3://<YOUR_ORGANIZATION>-kb-knowledge-articles --region <REGION>
```

### Step 3: Create and Configure Bedrock Knowledge Base

This is a critical step - the Knowledge Base must be created before deploying the Lambda functions.

#### Prerequisites
1. **Enable Bedrock Model Access**:
   - Navigate to Amazon Bedrock Console
   - Click "Model access" in left navigation
   - Request access to:
     - Claude 3.5 Sonnet (or your chosen model)
     - Titan Text Embeddings v2
   - Wait for approval (usually instant for supported regions)

2. **Verify S3 Bucket Exists**:
```bash
aws s3 ls s3://<YOUR_ORGANIZATION>-kb-knowledge-articles/
# If bucket doesn't exist, create it:
aws s3 mb s3://<YOUR_ORGANIZATION>-kb-knowledge-articles --region <REGION>
```

#### Create Knowledge Base (Step-by-Step)

**Step 3.1: Navigate to Bedrock Console**
1. Go to AWS Console → Amazon Bedrock
2. Select your region (e.g., `us-west-2` or your preferred region)
3. In left navigation, click **"Knowledge bases"**
4. Click **"Create knowledge base"** button

**Step 3.2: Provide Knowledge Base Details**
1. **Knowledge base name**: `<YOUR_ORGANIZATION>-knowledge-base`
2. **Description**: `Knowledge Base for Salesforce AI Chat with RAG capabilities`
3. **IAM permissions**:
   - Select: **"Create and use a new service role"**
   - Role name will auto-generate: `AmazonBedrockExecutionRoleForKnowledgeBase_xxxxx`
   - **Important**: Note this role name for later
4. **Tags** (optional):
   - Key: `Environment`, Value: `<ENVIRONMENT>`
   - Key: `Application`, Value: `salesforce-ai-chat`
5. Click **"Next"**

**Step 3.3: Set Up Data Source**
1. **Data source name**: `<YOUR_ORGANIZATION>-knowledge-base-s3`
2. **S3 URI**: Browse and select `s3://<YOUR_ORGANIZATION>-kb-knowledge-articles/`
   - Or manually enter: `s3://<YOUR_ORGANIZATION>-kb-knowledge-articles`
3. **Chunking strategy**:
   - Select: **"Default chunking"**
   - Max tokens: 300
   - Overlap percentage: 20%
   - (These defaults work well for knowledge articles)
4. **Metadata and filtering** (optional): Leave default
5. Click **"Next"**

**Step 3.4: Select Embeddings Model**
1. **Embeddings model**: Select **"Titan Text Embeddings v2"**
2. **Model configuration**:
   - Dimensions: **1024** (recommended)
   - Normalize: Yes (default)

**Step 3.5: Configure Vector Store**
1. **Vector database**: Select **"Quick create a new vector store"**
   - This creates an OpenSearch Serverless collection automatically
   - Collection name: Auto-generated (e.g., `bedrock-knowledge-base-xxxxx`)
   
   **OR** if you want to use existing OpenSearch:
   - Select **"Choose a vector store you have created"**
   - Choose existing OpenSearch Serverless collection
   - Provide index name and field mappings

2. For **Quick create**, the following are configured automatically:
   - Collection ARN: (auto-generated)
   - Vector index name: `bedrock-knowledge-base-default-index`
   - Vector field name: `bedrock-knowledge-base-default-vector`
   - Text field name: `AMAZON_BEDROCK_TEXT`
   - Metadata field name: `AMAZON_BEDROCK_METADATA`

3. Click **"Next"**

**Step 3.6: Review and Create**
1. Review all settings
2. Click **"Create knowledge base"**
3. Wait for creation (typically 2-5 minutes)
4. **CRITICAL**: Once created, copy the following:
   - **Knowledge Base ID** (e.g., `ABCD1234XY`)
   - **Collection ARN** (visible in Vector store section)
   - **Data Source ID** (visible in Data sources tab)

#### Get Data Source ID
After creation, retrieve the Data Source ID:

```bash
# List data sources for your KB
aws bedrock-agent list-data-sources \
  --knowledge-base-id <YOUR_KB_ID> \
  --region <REGION>

# Output will show:
# {
#   "dataSourceSummaries": [
#     {
#       "dataSourceId": "ABCDEF123456",
#       "name": "<YOUR_ORGANIZATION>-knowledge-base-s3",
#       "status": "AVAILABLE"
#     }
#   ]
# }
```

Copy the `dataSourceId` - you'll need this for CloudFormation deployment.

#### Initial Data Sync (Optional Test)
Before integrating with Lambda, test the KB with sample data:

```bash
# Create a test article
cat > /tmp/test-article.json <<EOF
{
  "id": "kb-test-001",
  "title": "Test Knowledge Article",
  "topic": "Testing",
  "category": "Support",
  "content": "This is a test article to verify the knowledge base is working correctly. The AI should be able to retrieve and reference this content.",
  "metadata": {
    "author": "System Admin",
    "last_updated": "2025-10-15",
    "region": "US",
    "importance": "High",
    "source": "Test"
  }
}
EOF

# Upload to S3
aws s3 cp /tmp/test-article.json s3://<YOUR_ORGANIZATION>-kb-knowledge-articles/

# Trigger sync
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <YOUR_KB_ID> \
  --data-source-id <YOUR_DATA_SOURCE_ID> \
  --region <REGION>

# Check sync status
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <YOUR_KB_ID> \
  --data-source-id <YOUR_DATA_SOURCE_ID> \
  --region <REGION>
```

Wait for ingestion status to show `COMPLETE` (usually 1-2 minutes for small files).

#### Test Knowledge Base Query
Verify the KB is working:

```bash
# Create test query config
cat > /tmp/kb-test.json <<EOF
{
  "input": {
    "text": "Tell me about the test article"
  },
  "retrieveAndGenerateConfiguration": {
    "type": "KNOWLEDGE_BASE",
    "knowledgeBaseConfiguration": {
      "knowledgeBaseId": "<YOUR_KB_ID>",
      "modelArn": "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
    }
  }
}
EOF

# Test query
aws bedrock-agent-runtime retrieve-and-generate \
  --cli-input-json file:///tmp/kb-test.json \
  --region <REGION>
```

If successful, you'll see a response with the AI's answer based on your test article.

#### Update CloudFormation Parameters
Now that you have your Knowledge Base created, update the parameters:

**For Knowledge Sync Lambda Stack**:
```bash
aws cloudformation create-stack \
  --stack-name salesforce-knowledge-sync \
  --template-body file://knowledge-sync-template.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=<ENVIRONMENT> \
    ParameterKey=S3BucketName,ParameterValue=<YOUR_ORGANIZATION>-kb-knowledge-articles \
    ParameterKey=KnowledgeBaseId,ParameterValue=<YOUR_KB_ID> \
    ParameterKey=DataSourceId,ParameterValue=<YOUR_DATA_SOURCE_ID> \
  --capabilities CAPABILITY_NAMED_IAM
```

**For WebSocket Chat Stack**:
Update the Lambda environment variable after stack creation:
```bash
aws lambda update-function-configuration \
  --function-name websocket-bedrock-chat-<ENVIRONMENT> \
  --environment Variables="{
    TABLE_NAME=websocket-connections-<ENVIRONMENT>,
    BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0,
    KNOWLEDGE_BASE_ID=<YOUR_KB_ID>
  }" \
  --region <REGION>
```

### Step 4: Update Lambda Environment Variables

```bash
# Update Chat Lambda with KB ID
aws lambda update-function-configuration \
  --function-name websocket-bedrock-chat-<ENVIRONMENT> \
  --environment Variables="{
    TABLE_NAME=websocket-connections-<ENVIRONMENT>,
    BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0,
    KNOWLEDGE_BASE_ID=<YOUR_KB_ID>
  }" \
  --region <REGION>
```

### Step 5: Configure Salesforce

#### Deploy LWC Component
```bash
# Using Salesforce CLI
sfdx force:source:deploy -p force-app/main/default/lwc/aiChatInterface
```

#### Create Named Credential
1. Setup → Named Credentials → New Named Credential
2. **Settings**:
   - Label: `AWS_Lambda_S3_Sync`
   - Name: `AWS_Lambda_S3_Sync`
   - URL: `<Lambda Function URL from CloudFormation outputs>`
   - Identity Type: Named Principal
   - Authentication Protocol: Password (or Anonymous if no auth)
   - Generate Authorization Header: Yes

#### Update LWC with WebSocket URL
In `aiChatInterface.js`, update:
```javascript
wsUrl = 'wss://<YOUR_API_ID>.execute-api.us-west-2.amazonaws.com/dev';
```

#### Deploy Apex Classes
```bash
sfdx force:source:deploy -p force-app/main/default/classes/KnowledgeToS3Handler.cls
sfdx force:source:deploy -p force-app/main/default/classes/KnowledgeToS3Queueable.cls
```

#### Add Remote Site Settings
Setup → Remote Site Settings → New
- Name: `AWS_Lambda`
- URL: `https://<lambda-function-url>`

#### Configure Trusted URL for WebSocket
**Critical**: WebSocket connections require Trusted URL configuration in Salesforce

1. Setup → Security → CSP Trusted Sites → New Trusted Site
2. **Settings**:
   - **Trusted Site Name**: `AWS_WebSocket`
   - **Trusted Site URL**: `https://<YOUR_API_GATEWAY_ID>.execute-api.<REGION>.amazonaws.com`
   - **Description**: WebSocket connection for AI Chat
   - **Active**: ✅ Checked

3. **CSP Context**: Select `All`

4. **CSP Directives** (Enable the following):
   - ✅ `connect-src` (scripts) - **REQUIRED for WebSocket**
   - ✅ `font-src` (fonts)
   - ✅ `frame-src` (iframe content)
   - ✅ `img-src` (images)
   - ✅ `media-src` (audio and video)
   - ✅ `style-src` (stylesheets)

5. **Permissions Policy Directives** (Optional):
   - `camera` - Enable if adding video chat
   - `microphone` - Enable if adding voice input

**⚠️ Important Notes**:
- The URL must be HTTPS (WebSocket uses WSS)
- Must include full domain without the path
- `connect-src` directive is **mandatory** for WebSocket connections
- Changes may take a few minutes to propagate

**Verification**:
```javascript
// Test in Browser Console (from Salesforce page)
const ws = new WebSocket('wss://<YOUR_API_GATEWAY_ID>.execute-api.<REGION>.amazonaws.com/<STAGE>');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Connection failed:', e);
```

If you see connection errors, verify:
1. Trusted URL is Active
2. `connect-src` directive is enabled
3. URL matches exactly (no trailing slashes)

### Step 6: Test the Integration

#### Test Knowledge Sync
```apex
// Execute in Developer Console
List<Knowledge__kav> articles = [
    SELECT Id, ArticleNumber, Title, content__c 
    FROM Knowledge__kav 
    WHERE PublishStatus = 'Online' 
    LIMIT 1
];
KnowledgeToS3Handler.processArticles(articles);
```

#### Test Chat Interface
1. Add LWC to App Page or Home Page
2. Open the page
3. Verify connection status shows "Connected"
4. Send a test message
5. Verify response appears with Claude's answer

---

## Known Issues & Workarounds

### 1. Knowledge Article Trigger Limitations

**Issue**: Salesforce does not fire Apex triggers on publish/archive operations

**Official Salesforce Statement**:
> "Actions that change the publication status of a KAV record, such as Publish and Archive, do not fire Apex or flow triggers. However, sometimes publishing an article from the UI causes the article to be saved, and in these instances the before update and after update triggers are called."


### 2. WebSocket Connection Timeouts

**Issue**: WebSocket connections timeout after 10 minutes of inactivity

**Solution**: Implement heartbeat mechanism (future enhancement)

### 3. Lambda Cold Starts

**Issue**: First request after inactivity may be slow (3-5 seconds)

**Mitigation**:
- Provisioned concurrency for Lambda functions
- Keep-alive pings from client

---

## Troubleshooting

### Chat Not Connecting

**Symptoms**: Status shows "Connecting..." or "Disconnected"

**Checks**:
1. **Verify Trusted URL is configured** ⚠️ Most Common Issue
   - Setup → Security → CSP Trusted Sites
   - Ensure `AWS_WebSocket` exists and is Active
   - Verify `connect-src` directive is enabled
   - URL should be: `https://<YOUR_API_GATEWAY_ID>.execute-api.<REGION>.amazonaws.com`
   
2. **Check Browser Console** for CSP errors:
   ```
   Refused to connect to 'wss://...' because it violates the following 
   Content Security Policy directive: "connect-src..."
   ```
   → If you see this, Trusted URL is not configured correctly

3. Verify WebSocket URL is correct in LWC
4. Check API Gateway stage is deployed
5. Review Lambda logs:
   ```bash
   aws logs tail /aws/lambda/websocket-connect-<ENVIRONMENT> --follow --region <REGION>
   ```
6. Check CORS settings in API Gateway

### No Responses from AI

**Symptoms**: Messages sent but no replies

**Checks**:
1. Check Lambda logs:
   ```bash
   aws logs tail /aws/lambda/websocket-bedrock-chat-<ENVIRONMENT> --follow --region <REGION>
   ```
2. Verify Bedrock model access:
   ```bash
   aws bedrock list-foundation-models --region <REGION>
   ```
3. Check IAM permissions for Lambda role
4. Verify Knowledge Base ID is correct

### Knowledge Articles Not Syncing

**Symptoms**: Questions not answered with knowledge base content

**Checks**:
1. Check S3 bucket for article files:
   ```bash
   aws s3 ls s3://<YOUR_ORGANIZATION>-kb-knowledge-articles/
   ```
2. Review Lambda Function logs:
   ```bash
   aws logs tail /aws/lambda/sf-knowledge-s3-sync-<ENVIRONMENT> --follow --region <REGION>
   ```
3. Check Named Credential configuration in Salesforce
4. Test Lambda Function URL directly:
   ```bash
   curl -X POST <LAMBDA_URL> \
     -H "Content-Type: application/json" \
     -d '{"id":"test","title":"Test","content":"Test content"}'
   ```
5. Check Knowledge Base ingestion jobs:
   ```bash
   aws bedrock-agent list-ingestion-jobs \
     --knowledge-base-id <YOUR_KB_ID> \
     --data-source-id <YOUR_DATA_SOURCE_ID> \
     --region <REGION>
   ```

### Session Not Persisting

**Symptoms**: AI doesn't remember previous conversation context

**Checks**:
1. Verify DynamoDB table has `bedrockSessionId` attribute
2. Check Lambda has DynamoDB update permissions
3. Review Chat Lambda logs for session storage errors

### Vector Search Not Finding Articles

**Symptoms**: AI says "I don't have information" despite articles existing

**Checks**:
1. Verify embeddings were generated:
   - Check OpenSearch Serverless collection
   - Verify index contains documents
2. Test search directly:
   ```python
   response = bedrock_agent_runtime.retrieve(
       knowledgeBaseId='<YOUR_KB_ID>',
       retrievalQuery={'text': 'test query'}
   )
   ```
3. Check article content quality (too short may not embed well)
4. Verify numberOfResults in Lambda (currently set to 3)

