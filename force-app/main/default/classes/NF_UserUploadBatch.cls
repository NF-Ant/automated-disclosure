public with sharing class NF_UserUploadBatch implements Database.Batchable<NF_UserManagementService.ConnectUserDetails>, Database.Stateful, Database.AllowsCallouts {
    
    private final String namedCred;
    private final String instanceId;
    private final String callCenterId;
    public List<NF_UserManagementService.ConnectUserDetails> usersToCreateWrapper;
    public List<NF_UserManagementService.ConnectUserCreateResponse> newConnectUsersList;
    
    public NF_UserUploadBatch(String namedCred, String instanceId, String callCenterId, List<NF_UserManagementService.ConnectUserDetails> usersToCreateWrapper) {
        this.namedCred = namedCred;
        this.instanceId = instanceId;
        this.callCenterId = callCenterId;
        this.usersToCreateWrapper = usersToCreateWrapper;
        this.newConnectUsersList = new List<NF_UserManagementService.ConnectUserCreateResponse>();
    }

    public Iterable<NF_UserManagementService.ConnectUserDetails> start(Database.BatchableContext info) {
        return this.usersToCreateWrapper;
    }

    public void execute(Database.BatchableContext info, List<NF_UserManagementService.ConnectUserDetails> scope) {
        if(!scope.isEmpty()) {
            NF_UserManagementService.ConnectUserCreateResponse createUserResponse;
            String response;
            for(NF_UserManagementService.ConnectUserDetails userDetail : usersToCreateWrapper) {
                HttpRequest request = new HttpRequest();
                request.setEndpoint('callout:' + this.namedCred + '/users/' + this.instanceId);
                request.setMethod('PUT');
                request.setBody(NF_UserManagementService.createUserRequestBody(userDetail));
                response = getResponse(request);
                if(String.isNotBlank(response)) {
                    createUserResponse = (NF_UserManagementService.ConnectUserCreateResponse)JSON.deserialize(response, NF_UserManagementService.ConnectUserCreateResponse.class);
                    createUserResponse.userSalesforceId = userDetail.userId;
                    this.newConnectUsersList.add(createUserResponse);
                }
            }
        }
    }

    public void finish(Database.BatchableContext info) {
        if(!this.newConnectUsersList.isEmpty() && !Test.isRunningTest()) {
            new NF_UserManagementService().createCallCenterRoutingMapRecords(this.newConnectUsersList, this.callCenterId);
        }
    }

    private String getResponse(HttpRequest request) {
        try {
            if(request != null){
                HttpResponse response = new Http().send(request);
                if(response.getStatusCode() == 200) {
                    return response.getBody();
                }else {
                	throw new CalloutException(response.getStatusCode() + ':' + response.getBody());
                }
            }else
            	return null;
        }
        catch(Exception ex) {
            System.debug('error =>'+ex);
        }
        return '';
    }
}