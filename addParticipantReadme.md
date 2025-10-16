FlowTransfer LWC Component
Overview
The FlowTransfer component is a Lightning Web Component (LWC) designed to facilitate automated call transfers in Salesforce Service Cloud Voice with Amazon Connect. It handles the complete transfer lifecycle, including initiating transfers, managing disclosure messages, and automatically resuming customer connections after required disclosures.
Key Features

Automated Call Transfers: Initiate transfers to Amazon Connect queues or agents directly from Salesforce flows
Disclosure Message Support: Handles the required regulatory disclosure message flow before completing transfers
Event-Driven Architecture: Uses Amazon Connect telephony events to manage the transfer lifecycle
Flow Integration: Can be triggered automatically within Salesforce flows or manually by agents
Status Tracking: Provides real-time status updates and output variables for flow branching logic

Technical Components
LWC Component Files

flowTransfer.js: Core JavaScript functionality for call transfer operations
flowTransfer.html: UI elements for displaying transfer status and manual controls
flowTransfer.css: Styling for the component
flowTransfer.js-meta.xml: Configuration metadata for Flow integration

Amazon Connect Flow
The associated Amazon Connect flow provides the required disclosure message functionality:

Puts the previous agent on hold
Plays the regulatory compliance message
Disconnects from the disclosure flow to continue with the transfer

How It Works

Initialization: The component initializes and connects to the Service Cloud Voice Toolkit API
Transfer Initiation: When triggered (automatically or manually), initiates a non-blind transfer to the specified destination
Disclosure Phase:

Detects when the Amazon Connect disclosure flow is connected ("participantadded" event)
Monitors for completion of the disclosure message ("participantremoved" event)


Customer Reconnection: Automatically resumes the customer connection after the disclosure completes
Completion: Signals transfer success back to the Salesforce Flow with status outputs

Input Parameters
ParameterTypeDescriptionrecordIdStringThe Salesforce record ID associated with the callautoExecuteBooleanWhen true, automatically executes the transfer without manual interventiontransferDestinationStringAmazon Connect ARN of the transfer destination (queue or agent)
Output Parameters
ParameterTypeDescriptiontransferSuccessBooleanIndicates if the transfer was successfully initiatedtransferMessageStringDetailed message about the transfer statustransferCompleteBooleanIndicates if the entire transfer process has completed
Setup Instructions
Prerequisites

Salesforce Service Cloud Voice configured with Amazon Connect
Voice Toolkit API permissions enabled for your org
Amazon Connect instance with the disclosure flow deployed

Deployment Steps

Deploy the LWC Component:

Deploy all component files to your Salesforce org
Ensure the proper permissions are set


Configure Amazon Connect Flow:

Import the provided JSON flow definition into your Amazon Connect instance
Update the disclosure message text as needed for your compliance requirements


Create a Salesforce Flow:

Add the FlowTransfer component to a Screen element in your flow
Configure the input parameters, especially the transferDestination ARN
Add decision elements based on the output parameters to handle success/failure paths



Usage Examples
Automatic Transfer in a Flow
Configure the component with autoExecute set to true in a Salesforce Flow to automatically transfer the call when the screen is displayed:
Input Parameters:
- recordId: {!recordId}
- autoExecute: true
- transferDestination: "arn:aws:connect:us-west-2:117301763745:instance/3b0dc5e2-768d-420e-87de-a9216062a0b0/transfer-destination/1d3de879-82c0-46ff-8b2f-110a53969a95"

Output Parameters:
- transferSuccess: {!transferSuccess}
- transferMessage: {!transferMessage}
- transferComplete: {!transferComplete}
Manual Agent-Initiated Transfer
Configure the component with autoExecute set to false to allow agents to manually trigger the transfer when needed:
Input Parameters:
- recordId: {!recordId}
- autoExecute: false
- transferDestination: "arn:aws:connect:us-west-2:117301763745:instance/3b0dc5e2-768d-420e-87de-a9216062a0b0/transfer-destination/1d3de879-82c0-46ff-8b2f-110a53969a95"

Output Parameters:
- transferSuccess: {!transferSuccess}
- transferMessage: {!transferMessage}
- transferComplete: {!transferComplete}
Troubleshooting
Common Issues

Voice Toolkit Not Available: Ensure the Service Cloud Voice Toolkit API is properly enabled in your org
Transfer Fails to Initiate: Verify the transferDestination ARN is correct and accessible
Disclosure Flow Issues: Check that the Amazon Connect flow is properly deployed and configured
Customer Not Resumed: If the customer is not automatically reconnected, use the manual resume button

Debugging
The component includes extensive console logging. Check your browser's developer console for messages prefixed with 'FlowTransfer' to trace the execution flow and diagnose issues.
Event Handling
The component listens for the following Service Cloud Voice events:

callstarted: Tracks when calls begin
callconnected: Tracks when calls connect
callended: Tracks when calls end
participantadded: Detects when the disclosure flow joins
participantremoved: Detects when the disclosure flow completes
messageended: Tracks message completion
disclosureended: Tracks disclosure completion
playbackended: Tracks audio playback completion