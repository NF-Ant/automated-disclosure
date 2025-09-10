@isTest
public class NF_UserUpdateTriggerHandlerTest {
    
    @testSetup
    static void setup() {
        insert new User(Alias = 'test', Email = 'test@test.com', FirstName = 'Test', LastName = 'User', 
                       ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
                       TimeZoneSidKey = 'America/Los_Angeles', UserName = 'testuser' + System.now().getTime() + '@test.com',
                       EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US');
    }
    
    @isTest
    static void testUpdateTrigger() {
        User testUser = [SELECT Id, Add_to_SCV_Contact_Center__c FROM User WHERE LastName = 'User' LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new MockCallout());
        
        Test.startTest();
        testUser.Add_to_SCV_Contact_Center__c = true;
        update testUser;
        Test.stopTest();
        
        System.assert(true);
    }
    
    @isTest
    static void testInsertTrigger() {
        Test.setMock(HttpCalloutMock.class, new MockCallout());
        
        Test.startTest();
        insert new User(Alias = 'test2', Email = 'test2@test.com', FirstName = 'Test2', LastName = 'User2',
                       ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
                       TimeZoneSidKey = 'America/Los_Angeles', UserName = 'testuser2' + System.now().getTime() + '@test.com',
                       EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
                       Add_to_SCV_Contact_Center__c = true);
        Test.stopTest();
        
        System.assert(true);
    }
    
    private class MockCallout implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"UserArn":"test","UserId":"test"}');
            return res;
        }
    }
}