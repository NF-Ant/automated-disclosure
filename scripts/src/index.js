import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { deleteDynamoDb, updateDynamoDB } from "./helper.js";
const dbClient = new DynamoDBClient({ region: process.env.region });
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);
const DYNAMOTABLE = process.env.DDB_TABLE;
let ddbtable
let response = {}

export const handler = async (event) => {
    console.log("Event is :", JSON.stringify(event, "", 2))
    console.log(event.body)
    //body is base64 encoded so parse it.
    // const buffer = Buffer.from(event.body, 'base64');
    try {
        const body = JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'));
        console.log(`Body is ${JSON.stringify(body, "", 2)}`)
        const reasonTrigger = body['EventTriggered']
        console.log(`Reason is : ${reasonTrigger}`)
        const records = body['Data']
        console.log(`records : ${JSON.stringify(records, "", 2)}  `)
        console.log("Trigger Reason : ", reasonTrigger)

        ddbtable = DYNAMOTABLE;
        if(records[0]['attributes']['type'] === "IVR_Prompts_and_Config__c"){
            ddbtable = process.env.IVR_CONFIG_AND_PROMPTS_TABLE;
        }

        if (reasonTrigger.toLowerCase().includes("update") || reasonTrigger.toLowerCase().includes("inserted")) {
            console.log("Operation is Update")
            response = await updateDynamoDB(ddbDocClient, ddbtable, records)
            console.log(response)
        }
        else if (reasonTrigger.toLowerCase().includes("delete")) {
            console.log("Operation is Delete")
            response = await deleteDynamoDb(ddbDocClient, ddbtable, records)
            console.log(response)
        }

        if (response.statusCode == 200) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "Record updated successfully"
                })
            }
        }
        else {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: "Internal server error"
                })
            }
        }




    }
    catch (error) {
        console.error(error)
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server error"
            })
        }
    }

}





