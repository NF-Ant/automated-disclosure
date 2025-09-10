public class KnowledgeToS3Queueable implements Queueable, Database.AllowsCallouts {
    
    private Set<Id> masterArticleIds;
    
    public KnowledgeToS3Queueable(Set<Id> masterArticleIds) {
        this.masterArticleIds = masterArticleIds;
    }
    
    public void execute(QueueableContext context) {
        // Query latest online versions
        List<Knowledge__kav> publishedArticles = [
            SELECT Id, Title, VersionNumber, PublishStatus, Language, KnowledgeArticleId
            FROM Knowledge__kav
            WHERE KnowledgeArticleId IN :masterArticleIds
              AND PublishStatus = 'Online'
              AND IsLatestVersion = true
        ];
        
        if (!publishedArticles.isEmpty()) {
            System.debug('Queueable processing published articles: ' + publishedArticles);
            KnowledgeToS3Handler.processArticles(publishedArticles);
        }
    }
}
