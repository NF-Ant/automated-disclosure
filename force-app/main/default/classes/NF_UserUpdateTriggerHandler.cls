public with sharing class NF_UserUpdateTriggerHandler {
        
    public static void isUpdateInsert(Map<Id, User> newUsers, Map<Id, User> oldUsers){
        Set<Id> userIdsToOnboard = new Set<Id>();

        if(Trigger.isUpdate){
            for(User newUser : newUsers.values()){
                User oldUser = oldUsers.get(newUser.Id);

                if(newUser.Add_to_SCV_Contact_Center__c && !oldUser.Add_to_SCV_Contact_Center__c && newUser.IsActive && newUser.UserType == 'Standard'){      
                    userIdsToOnboard.add(newUser.Id);
                }
            }
		} else { 
            for(User newUser : newUsers.values()){
                if(newUser.IsActive && newUser.Add_to_SCV_Contact_Center__c && newUser.UserType == 'Standard'){
                    userIdsToOnboard.add(newUser.Id);
                }
            }      
        }
        
        if(!userIdsToOnboard?.isEmpty()) {
			try{            
                String sfCallCenterInternalName = System.Label.Amazon_CallCenter_InternalName;
                String sfCallCenterId;
                List<CallCenter> callCenterList = [SELECT Id, InternalName FROM CallCenter WHERE InternalName like :sfCallCenterInternalName LIMIT 1];
                if(!callCenterList.isEmpty()) {
                    sfCallCenterId = callCenterList[0].Id;
                }
                new NF_UserManagementService().createUsersInConnect(userIdsToOnboard,sfCallCenterId);
            }
            catch(Exception ex){
            	System.debug('error =>'+ex.getStackTraceString());
        	}
        }
    }
}