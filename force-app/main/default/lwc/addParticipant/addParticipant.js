// flowTransfer.js
import { LightningElement, api, track } from 'lwc';

export default class FlowTransfer extends LightningElement {
    @api recordId;
    @api autoExecute = false;
    @api transferDestination = "arn:aws:connect:us-west-2:117301763745:instance/3b0dc5e2-768d-420e-87de-a9216062a0b0/transfer-destination/1d3de879-82c0-46ff-8b2f-110a53969a95";
    
    // Output variables for Flow
    @api transferSuccess = false;
    @api transferMessage = '';
    @api transferComplete = false;
    
    // Track transfer state
    @track status = 'Initializing...';
    @track isProcessing = false;
    @track transferInitiated = false;
    @track disclosurePhase = false;

    constructor() {
        super();
        this.telephonyEventListener = this.onTelephonyEvent.bind(this);
    }

    connectedCallback() {
        console.log('FlowTransfer component connected');
        setTimeout(() => {
            this.initializeVoiceToolkit();
        }, 1000);
    }

    renderedCallback() {
        // Auto-execute if requested by Flow
        if (this.autoExecute && !this.isProcessing && !this.transferComplete) {
            setTimeout(() => {
                this.executeTransfer();
            }, 2000);
        }
    }

    initializeVoiceToolkit() {
        const toolkitApi = this.getToolkitApi();
        if (toolkitApi) {
            console.log('Voice toolkit found, subscribing to events');
            toolkitApi.addEventListener("callstarted", this.telephonyEventListener);
            toolkitApi.addEventListener("callconnected", this.telephonyEventListener);
            toolkitApi.addEventListener("callended", this.telephonyEventListener);
            toolkitApi.addEventListener("participantadded", this.telephonyEventListener);
            toolkitApi.addEventListener("participantremoved", this.telephonyEventListener);
            // Add event listeners for disclosure/message events
            toolkitApi.addEventListener("messageended", this.telephonyEventListener);
            toolkitApi.addEventListener("disclosureended", this.telephonyEventListener);
            toolkitApi.addEventListener("playbackended", this.telephonyEventListener);
            this.status = 'Voice toolkit ready';
        } else {
            console.error('Voice toolkit not found');
            this.status = 'Voice toolkit not available';
            this.transferMessage = 'Voice toolkit not available in Flow context';
        }
    }

    // Public method that Flow can call
    @api
    executeTransfer() {
        console.log('executeTransfer called');
        this.isProcessing = true;
        this.transferInitiated = true;
        this.status = 'Initiating transfer...';
        
        try {
            const toolkitApi = this.getToolkitApi();
            if (!toolkitApi) {
                throw new Error('Voice toolkit not available');
            }
            
            toolkitApi.addParticipant(
                "AgentOrQueueId",
                this.transferDestination,
                false // non-blind transfer
            );
            
            this.status = 'Transfer initiated successfully';
            this.transferMessage = 'Transfer request sent';
            this.transferSuccess = true;
            
        } catch (error) {
            console.error('Transfer failed:', error);
            this.status = `Transfer failed: ${error.message}`;
            this.transferMessage = error.message;
            this.transferSuccess = false;
            this.transferComplete = true;
            this.isProcessing = false;
            this.transferInitiated = false;
        }
    }

    // Handle voice events
    onTelephonyEvent(event) {
        console.log('Voice Event in Flow:', event.type, event.detail, 'Transfer initiated:', this.transferInitiated, 'Disclosure phase:', this.disclosurePhase);
        
        if (event.type === "participantadded") {
            this.status = 'Participant added - disclosure starting';
            this.transferMessage = 'Queue connected, playing disclosure message';
            this.disclosurePhase = true;
        }
        
        if (event.type === "participantremoved") {
            if (this.disclosurePhase && this.transferInitiated) {
                // First participantremoved = disclosure finished
                console.log('Disclosure participant removed - resuming customer');
                this.status = 'Disclosure finished - resuming customer';
                this.transferMessage = 'Automated message completed, connecting customer';
                this.disclosurePhase = false;
                
                setTimeout(() => {
                    this.resumeCustomerAfterDisclosure();
                }, 1000);
                
            } else if (this.transferInitiated && !this.disclosurePhase) {
                // Second participantremoved = agent leaving after transfer
                console.log('Agent participant removed - transfer complete');
                this.status = 'Transfer completed successfully';
                this.transferMessage = 'Transfer completed, customer with new agent';
                this.transferComplete = true;
                this.isProcessing = false;
                this.transferInitiated = false;
            }
        }
    }

    resumeCustomerAfterDisclosure() {
        try {
            const toolkitApi = this.getToolkitApi();
            toolkitApi.resume("Initial_Caller");
            this.status = 'Customer connected after disclosure';
            this.transferMessage = 'Customer is now connected to the queue';
            this.transferComplete = true;
            this.isProcessing = false;
        } catch (error) {
            console.error('Resume after disclosure failed:', error);
            this.status = `Resume failed: ${error.message}`;
            this.transferMessage = `Disclosure completed but resume failed: ${error.message}`;
            this.transferComplete = true;
            this.isProcessing = false;
        }
    }

    resumeCustomer() {
        try {
            const toolkitApi = this.getToolkitApi();
            toolkitApi.resume("Initial_Caller");
            this.status = 'Customer resumed successfully';
            this.transferMessage = 'Transfer completed and customer resumed';
            this.transferComplete = true;
            this.isProcessing = false;
        } catch (error) {
            console.error('Resume failed:', error);
            this.status = `Resume failed: ${error.message}`;
            this.transferMessage = `Transfer completed but resume failed: ${error.message}`;
            this.transferComplete = true;
            this.isProcessing = false;
        }
    }

    getToolkitApi() {
        return this.template.querySelector("lightning-service-cloud-voice-toolkit-api");
    }

    // Manual trigger for testing
    handleManualTransfer() {
        this.executeTransfer();
    }

    // Manual resume for backup
    handleManualResume() {
        this.resumeCustomerAfterDisclosure();
    }
}