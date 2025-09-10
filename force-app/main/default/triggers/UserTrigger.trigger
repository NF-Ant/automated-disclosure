trigger UserTrigger on User (after insert, after update) {
    NF_UserUpdateTriggerHandler.isUpdateInsert(Trigger.newMap, Trigger.oldMap);
}