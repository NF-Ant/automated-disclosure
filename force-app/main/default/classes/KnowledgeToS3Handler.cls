public class KnowledgeToS3Handler {
    
    @future(callout=true)
    public static void processArticles(List<Id> articleIds) {
        
        // Query articles with all necessary fields
        List<Knowledge__kav> articles = [
            SELECT Id, ArticleNumber, Title, Summary, 
                   content__c, PublishStatus, LastModifiedDate,
                   LastModifiedBy.Name, CreatedBy.Name
            FROM Knowledge__kav 
            WHERE Id IN :articleIds
        ];
        System.debug(articles);
        
        for (Knowledge__kav article : articles) {
            try {
                // Build JSON payload for Lambda
                String jsonPayload = buildArticleJson(article);
                
                // Send to Lambda
                sendToLambda(jsonPayload);
                
                System.debug('Successfully sent article: ' + article.Title);
                
            } catch (Exception e) {
                System.debug('Error processing article ' + article.Title + ': ' + e.getMessage());
                // Log error to custom object or platform events for monitoring
                logError(article.Id, article.Title, e.getMessage());
            }
        }
    }
    
    // Helper method to convert list to IDs for future method
    public static void processArticles(List<Knowledge__kav> articles) {
        List<Id> articleIds = new List<Id>();
        for (Knowledge__kav article : articles) {
            articleIds.add(article.Id);
        }
        
        if (!articleIds.isEmpty()) {
            processArticles(articleIds);
        }
    }
    
    private static String buildArticleJson(Knowledge__kav article) {
        Map<String, Object> articleData = new Map<String, Object>();
        
        // Basic article information
        articleData.put('id', 'kb-' + article.ArticleNumber);
        articleData.put('title', article.Title);
        articleData.put('topic', 'Knowledge Base'); // Default or map from category field
        articleData.put('category', 'Customer Support'); // Default or map from data category
        
        // Content - this will be the rich text field
        articleData.put('content', article.content__c != null ? article.content__c : '');
        
        // Metadata
        Map<String, Object> metadata = new Map<String, Object>();
        metadata.put('author', article.LastModifiedBy.Name);
        metadata.put('last_updated', article.LastModifiedDate.format('yyyy-MM-dd'));
        metadata.put('region', 'US'); // Default or map from org settings
        metadata.put('importance', 'Medium'); // Default or determine from fields
        
        articleData.put('metadata', metadata);
        
        // Related articles placeholder (can be enhanced later)
        List<Object> relatedArticles = new List<Object>();
        articleData.put('related_articles', relatedArticles);
        
        return JSON.serialize(articleData);
    }
    
    private static void sendToLambda(String jsonPayload) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:AWS_Lambda_S3_Sync'); // Named credential
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(jsonPayload);
        req.setTimeout(60000); // 60 second timeout
        
        Http http = new Http();
        HttpResponse res = http.send(req);
        
        if (res.getStatusCode() != 200) {
            throw new CalloutException('Lambda call failed: Status ' + res.getStatusCode() + ' - ' + res.getBody());
        }
        
        System.debug('Lambda response: ' + res.getBody());
    }
    
    private static void logError(Id articleId, String articleTitle, String errorMessage) {
        // Create a platform event or custom object record for error tracking
        // For now, just debug log - can be enhanced with proper error logging
        System.debug(LoggingLevel.ERROR, 
            'Knowledge Article S3 Sync Error - Article: ' + articleTitle + 
            ' (ID: ' + articleId + '), Error: ' + errorMessage);
    }
}