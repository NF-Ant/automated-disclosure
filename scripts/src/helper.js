
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

export async function updateDynamoDB(ddbDocClient, tableName, data) {
    console.log("Total records to update is :", data.length)

    // body is array of events. In the batch write you can max 
    // insert 25 records at once. So we need to chunk the data.
    if (data.length == 0 || tableName == null) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "No data found in the request body"
            })
        }
    }
    // add indexing and typing for each element in data.
    const data1 = addTyping(data)   // added typing and indexing.

    console.log(`data after adding primary key and sort Key ${JSON.stringify(data1, '', 2)}`)
    // now data is split into chunks of 25 objects..
    const chunkedArray = chunkArray(data1, 25)
    let updateCount = 0
    // process each chunk and update table.
    try {
        for (let chunk of chunkedArray) {

            console.log(`Updating ${chunk.length} records`)

            // prepare the params for batch write.
            const params = {
                RequestItems: {
                    [tableName]: chunk.map(item => ({
                        PutRequest: {
                            Item: item
                        }
                    }))
                }
            }
            console.log(JSON.stringify(params, "", 2))
            const command = new BatchWriteCommand(params);
            const response = await ddbDocClient.send(command);
            updateCount = updateCount + chunk.length
            console.log(`Updated ${updateCount} records`)

        }
        console.log(`Total record updated is: ${updateCount}`)
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "All Record updated successfully : "
            })
        }
    } catch (error) {
        console.error(error)
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "DB update Failed."
            })
        }
    }


}

export async function deleteDynamoDb(ddbDocClient, tableName, data) {

    console.log("Total records to delete is: ", data.length)
    // body is array of events. In the batch write you can max 
    // insert 25 records at once. So we need to chunk the data.
    if (data.length == 0 || tableName == null) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "No data found in the request body"
            })
        }
    }

    const data1 = addTyping(data);   //data1 is data with typing and indexing...
    console.log(`data after adding Partition key and sort Key ${JSON.stringify(data1, '', 2)}`)
    const chunkedArray = chunkArray(data1, 25)
    let updateCount = 0
    // process each chunk and update table.

    try {
        for (let chunk of chunkedArray) {
            console.log(`Deleting ${chunk.length} records`)
            const params = {
                RequestItems: {
                    [tableName]: chunk.map(item => ({
                        DeleteRequest: {
                            Key: {
                                Typing: item.Typing,
                                Indexing: item.Indexing
                            }
                        }
                    }))
                }
            }

            console.log(JSON.stringify(params, "", 2))
            const command = new BatchWriteCommand(params);
            const response = await ddbDocClient.send(command);
            updateCount = updateCount + chunk.length
            console.log(`Deleted ${updateCount} record\(s\)`)
        }
        console.log(`Total record deleted is: ${updateCount}`)
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "All Records deleted successfully : "
            })
        }
    }
    catch (error) {
        console.error(error)
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "DB update Failed."
            })
        }

    }


}

export function chunkArray(arr, chunkSize) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
}

const LanguageMapping = {
    English: "en-us",
    Spanish: "es-us"
}

/** function to add Primary and Sort Keys */
export function addTyping(dataArray) {
    // check the data to find out which Object it is.
    for (let i = 0; i < dataArray.length; i++) {
        let objType = dataArray[i]['attributes']['type']

        switch (objType) {
            case "Voice_Prompt__c":
                let prompt = {};
                prompt['Typing'] = "prompt";
                // prompt['language'] = LanguageMapping[dataArray[i].Language__c];
                prompt['language'] = dataArray[i].Language__c;
                prompt['Business Line'] = dataArray[i].Name;
                prompt['name'] = dataArray[i].Prompt_Name__c;
                prompt['Indexing'] = prompt['language'] + "#" + prompt['name'];
                prompt['prompt_value'] = dataArray[i].Prompt_value__c;

                // Replace the element in the array
                dataArray[i] = prompt;
                break;
            case "Dialogstate__c":
                let dialogState = {};
                dialogState['Typing'] = "dialogState";
                dialogState['Indexing'] = dataArray[i].Name;
                dialogState['dialog_name'] = dataArray[i].Name;
                dialogState['bot_name'] = dataArray[i].Bot_Name__c;
                dialogState['supported_intents'] = dataArray[i].Supported_Intents__c;
                dialogState['supported_contexts'] = dataArray[i].Supported_Context__c;
                dialogState['resolveConflict'] = dataArray[i].Resolve_Conflict__c;
                dialogState['required_slots'] = dataArray[i].Required_Slots__c;
                dialogState['optional_slots'] = dataArray[i].Optional_Slots__c;
                dialogState['initial_prompt_indexing'] = dataArray[i].Initial_Prompt_Indexing__c;
                dialogState['retry_prompt_1_indexing'] = dataArray[i].Retry_Prompt_1_Indexing__c;
                dialogState['retry_prompt_2_indexing'] = dataArray[i].Retry_Prompt_2_Indexing__c;
                dialogState['retry_prompt_3_indexing'] = dataArray[i].Retry_Prompt_3_Indexing__c;
                dialogState['dtmf_option_0'] = dataArray[i].DTMF_Option_0__c;
                dialogState['dtmf_option_1'] = dataArray[i].DTMF_Option_1__c;
                dialogState['dtmf_option_2'] = dataArray[i].DTMF_Option_2__c;
                dialogState['dtmf_option_3'] = dataArray[i].DTMF_Option_3__c;
                dialogState['dtmf_option_4'] = dataArray[i].DTMF_Option_4__c;
                dialogState['dtmf_option_5'] = dataArray[i].DTMF_Option_5__c;
                dialogState['dtmf_option_6'] = dataArray[i].DTMF_Option_6__c;
                dialogState['dtmf_option_7'] = dataArray[i].DTMF_Option_7__c;
                dialogState['dtmf_option_8'] = dataArray[i].DTMF_Option_8__c;
                dialogState['dtmf_option_9'] = dataArray[i].DTMF_Option_9__c;
                dialogState['x-amz-lex:allow-interrupt:*:*'] = dataArray[i].Allow_Interrupt__c;
                dialogState['x-amz-lex:audio:max-length-ms:*:*'] = dataArray[i].Audio_Max_Length__c;
                dialogState['x-amz-lex:audio:start-timeout-ms:*:*'] = dataArray[i].Audio_Start_Timeout__c;
                dialogState['x-amz-lex:audio:end-timeout-ms:*:*'] = dataArray[i].Audio_End_Timeout__c;
                dialogState['x-amz-lex:dtmf:end-timeout-ms:*:*'] = dataArray[i].DTMF_End_Timeout__c;
                dialogState['x-amz-lex:text:start-timeout-ms:*:*'] = dataArray[i].Text_Start_Timeout__c;
                // Replace the element in the array
                dataArray[i] = dialogState;
                break;
            case "IVR_Configurations__c":
                dataArray[i]['Typing'] = "ivrConfigurations";
                dataArray[i]['Indexing'] = dataArray[i].Name;
                break;
            case "Voice_Business_Rules__c":
                dataArray[i]['Typing'] = "voiceBusinessRules";
                dataArray[i]['Indexing'] = dataArray[i].Name;
                break;
            case "IVR_Prompts_and_Config__c":
                dataArray[i]['Typing'] = "ivrPromptsAndConfig";
                dataArray[i]['Indexing'] = dataArray[i].Name;
                break;
            case "Holiday_Prompt__c":
                dataArray[i]['Typing'] = "holidayPrompt";
                dataArray[i]['Indexing'] = dataArray[i].Name;
                break;
            case "Area_Code__c":
                dataArray[i]['Typing'] = "areaCode";
                dataArray[i]['Indexing'] = dataArray[i].Name;
                break;
            default:
                console.log("No primary key found")
        }
    }

    return dataArray;
}



