public with sharing class NF_UserManagementService {
    
    public Boolean createUsersInConnect(Set<id> userIdSet, String callCenterId) {
        List<String> securityProfileIds = new List<String>();
        String routingProfileId = System.Label.Amazon_Basic_Routing_Profile_Id;
        securityProfileIds.add(System.Label.Amazon_Admin_Security_Profile_Id);
        String instanceId = System.Label.Amazon_Instance_Id;
        String namedCred = System.Label.SCV_AWS_Named_Credentials;
        Boolean isSuccessful = false;
        List<ConnectUserDetails> usersToCreateWrapper = new List<ConnectUserDetails>();
        try {
            if(String.isNotBlank(namedCred) && String.isNotBlank(instanceId)){
                usersToCreateWrapper = prepareUsersForAmazonConnect(userIdSet, routingProfileId, securityProfileIds) ;
                if(usersToCreateWrapper != null && !usersToCreateWrapper.isEmpty()) {
                    NF_UserUploadBatch batchInstance = new NF_UserUploadBatch(namedCred, instanceId, callCenterId, usersToCreateWrapper);
                    Database.executeBatch(batchInstance, 10);
                    isSuccessful = true;
                }
            }
        } catch (Exception ex) {
            System.debug('error =>'+ex.getStackTraceString());
        }
        return isSuccessful;
    }
    
    public Boolean createCallCenterRoutingMapRecords(List<ConnectUserCreateResponse> createUserResponses, String callCenterId) {
        Boolean isSuccessful = false;
        try {
            if(!createUserResponses.isEmpty() && String.isNotBlank(callCenterId)) {
                
                // STEP 1: First update the User records to assign them to the Call Center
                List<User> usersToUpdate = new List<User>();
                for(ConnectUserCreateResponse response : createUserResponses) {
                    User userToUpdate = new User(
                        Id = response.userSalesforceId,
                        CallCenterId = callCenterId
                    );
                    usersToUpdate.add(userToUpdate);
                }
                
                if(!usersToUpdate.isEmpty()) {
                    update usersToUpdate;
                }
                
                // STEP 2: Now create the CallCenterRoutingMap records
                List<CallCenterRoutingMapWrapper> routingMapWrapperList = new List<CallCenterRoutingMapWrapper>();
                for(ConnectUserCreateResponse response : createUserResponses) {
                    CallCenterRoutingMapWrapper mapWrapper = new CallCenterRoutingMapWrapper();
                    mapWrapper.attributes = new RecordAttributes('CallCenterRoutingMap', response.userSalesforceId);
                    mapWrapper.CallCenterId = callCenterId;
                    mapWrapper.ExternalId = response.UserArn;
                    mapWrapper.ReferenceRecordId = response.userSalesforceId;
                    mapWrapper.MasterLabel = response.userSalesforceId;
                    mapWrapper.DeveloperName = 'User_' + response.userSalesforceId + '_' + callCenterId;
                    routingMapWrapperList.add(mapWrapper);
                }
                if(!routingMapWrapperList.isEmpty()) {
                    Http h = new Http();
                    HttpRequest req = new HttpRequest();
                    req.setMethod('POST');
                    req.setHeader('Authorization','Bearer ' + UserInfo.getSessionId().substring(15));
                    req.setHeader('Content-Type','application/json; charset=UTF-8'); 
                    req.setHeader('Accept','application/json');
                    req.setEndpoint(System.URL.getOrgDomainUrl().toExternalForm() + '/services/data/v53.0/composite/tree/CallCenterRoutingMap/');
                    req.setBody(JSON.serialize(new Map<String, Object>{'records' => routingMapWrapperList}));
                    HttpResponse resp = h.send(req);
                    Map<String, Object> responseMap = (Map<String, Object>)JSON.deserializeUntyped(resp.getBody());
                    if(responseMap.containskey('hasErrors')){
                        isSuccessful = !(Boolean)responseMap.get('hasErrors');
                    }
                }
            }
        } catch (Exception ex) {
            System.debug('error =>'+ex.getStackTraceString());
            System.debug('error =>'+ex.getMessage());
        }
        return isSuccessful;
    }
    
    public static String createUserRequestBody(ConnectUserDetails userDetail) {
        Map<String, Object> userRequestBody = new Map<String, Object>();
        if(userDetail != null) {
            userRequestBody.put('RoutingProfileId', userDetail.routingProfileId );
            userRequestBody.put('SecurityProfileIds', userDetail.securityProfileIds ) ;
            userRequestBody.put('PhoneConfig', new Map<String, Object>{'PhoneType' => 'SOFT_PHONE'});
            userRequestBody.put('IdentityInfo', new Map<String, Object>{'FirstName' => userDetail.firstName, 'LastName' => userDetail.lastName});
            userRequestBody.put('Username', userDetail.connectUserName);
        }
        System.debug(JSON.serialize(userRequestBody));
        return JSON.serialize(userRequestBody);
    }
    
    public static List<ConnectUserDetails> prepareUsersForAmazonConnect(Set<Id> userIdSet,String routingProfileId, List<String> securityProfileIds){
        List<ConnectUserDetails> userDetailsList = new List<ConnectUserDetails>();
        try{
            if(!userIdSet.isEmpty()) {
                List<User> userRecordList = new List<User>();
                userRecordList = [SELECT Id, Alias, FirstName, LastName FROM User WHERE Id IN :userIdSet];

                if(!userRecordList.isEmpty()) {
                    for(User userRec : userRecordList) {
                        ConnectUserDetails userDetail = new ConnectUserDetails();
                        userDetail.connectUserName = userRec.Alias + '@' + userRec.Id.to15() + '@' + ((Id)UserInfo.getOrganizationId()).to15();
                        userDetail.firstName = userRec.FirstName;
                        userDetail.lastName = userRec.LastName;
                        userDetail.userId = userRec.Id;
                        userDetail.routingProfileId = routingProfileId;
                        userDetail.securityProfileIds = securityProfileIds;
                        
                        userDetailsList.add(userDetail);
                    }
                }
                System.debug('userDetailsList => '+userDetailsList);
            }
        }catch (Exception ex) {
            System.debug('error =>'+ex);
        }
        return userDetailsList;
    }
    
    public class ConnectUserDetails {
        public String userId;
        public String routingProfileId;
        public List<String> permissionSet;
        public List<String> securityProfileIds;
        public String agentExtension;
        public String agentPhone;
        public String connectUserName = '';
        public String firstName = '';
        public String lastName = '';
    }
    
    public class ConnectUserCreateResponse {
        public String UserId;
        public String UserArn;
        public String userSalesforceId;
    }
    
    private class RecordAttributes {
        private String type;
        private String referenceId;
        private RecordAttributes(String type, String referenceId) {
            this.type = type;
            this.referenceId = referenceId;
        } 
    }
    
    private class CallCenterRoutingMapWrapper {
        private RecordAttributes attributes;
        private String CallCenterId;
        private String ExternalId;
        private String ReferenceRecordId;
        private String MasterLabel;
        private String DeveloperName;
    }
    
    public class UserManagementException extends Exception{}
}