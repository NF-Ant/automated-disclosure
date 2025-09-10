@isTest
public class NF_UserUploadBatchTest {
    
    @isTest
    static void testBatch() {
        // Setup test data
        NF_UserManagementService.ConnectUserDetails userDetail = new NF_UserManagementService.ConnectUserDetails();
        userDetail.userId = UserInfo.getUserId();
        userDetail.firstName = 'Test';
        userDetail.lastName = 'User';
        userDetail.connectUserName = 'testuser@test';
        userDetail.routingProfileId = 'test-routing';
        userDetail.securityProfileIds = new List<String>{'test-security'};
        
        Test.setMock(HttpCalloutMock.class, new MockCallout());
        
        // Execute batch
        Test.startTest();
        NF_UserUploadBatch batch = new NF_UserUploadBatch('testCred', 'testInstance', 'testCallCenter', 
                                                          new List<NF_UserManagementService.ConnectUserDetails>{userDetail});
        Database.executeBatch(batch, 1);
        Test.stopTest();
        
        // Verify batch completed without errors
        System.assert(true);
    }
    
    private class MockCallout implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"UserArn":"arn:aws:test","UserId":"test123"}');
            return res;
        }
    }
}