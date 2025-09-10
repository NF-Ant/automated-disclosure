import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import Id from '@salesforce/user/Id';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import USER_NAME_FIELD from '@salesforce/schema/User.Name';
import USER_EMAIL_FIELD from '@salesforce/schema/User.Email';

export default class ChatIframe extends LightningElement {
    @api height = '600'; // Allow height to be configurable
    @api chatUrl = 'd1krnn325nqq0r.cloudfront.net'; // Default for development
    
    @track isLoading = true;
    @track hasError = false;
    @track errorMessage = '';
    
    userId = Id;
    currentUser;
    
    // Wire user data
    @wire(getRecord, {
        recordId: '$userId',
        fields: [USER_NAME_FIELD, USER_EMAIL_FIELD]
    })
    wiredUser({ error, data }) {
        if (data) {
            this.currentUser = data;
            this.hasError = false;
        } else if (error) {
            console.error('Error loading user data:', error);
            this.hasError = true;
            this.errorMessage = 'Failed to load user data';
        }
    }
    
    connectedCallback() {
        // Listen for iframe messages (for future communication)
        window.addEventListener('message', this.handleIframeMessage.bind(this));
    }
    
    disconnectedCallback() {
        window.removeEventListener('message', this.handleIframeMessage.bind(this));
    }
    
    // Handle messages from iframe (for future use)
    handleIframeMessage(event) {
        // Validate origin for security
        // if (event.origin !== 'https://your-s3-domain.com') return;
        
        try {
            const data = event.data;
            
            switch (data.type) {
                case 'chat-ready':
                    this.isLoading = false;
                    this.hasError = false;
                    break;
                    
                case 'chat-error':
                    this.handleChatError(data.message);
                    break;
                    
                case 'resize-iframe':
                    this.handleResize(data.height);
                    break;
                    
                default:
                    console.log('Unknown message from iframe:', data);
            }
        } catch (error) {
            console.error('Error handling iframe message:', error);
        }
    }
    
    handleChatError(message) {
        this.hasError = true;
        this.errorMessage = message || 'Chat service unavailable';
        this.isLoading = false;
        
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Chat Error',
                message: this.errorMessage,
                variant: 'error'
            })
        );
    }
    
    handleResize(newHeight) {
        if (newHeight && newHeight > 200) {
            this.height = newHeight.toString();
        }
    }
    
    // Handle iframe load events
    handleIframeLoad(event) {
        console.log('Iframe loaded successfully');
        this.isLoading = false;
        this.hasError = false;
        
        // Send Salesforce context to iframe (for future use)
        this.sendContextToIframe();
    }
    
    handleIframeError(event) {
        console.error('Iframe failed to load:', event);
        this.handleChatError('Failed to load chat interface');
    }
    
    // Send Salesforce context to iframe
    sendContextToIframe() {
        if (!this.currentUser) return;
        
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            const contextData = {
                type: 'salesforce-context',
                userId: this.userId,
                userName: getFieldValue(this.currentUser, USER_NAME_FIELD),
                userEmail: getFieldValue(this.currentUser, USER_EMAIL_FIELD),
                timestamp: Date.now()
            };
            
            // Post message to iframe
            iframe.contentWindow.postMessage(contextData, '*');
        }
    }
    
    // Retry loading iframe
    retryLoad() {
        this.isLoading = true;
        this.hasError = false;
        this.errorMessage = '';
        
        // Force iframe reload by changing src slightly
        const iframe = this.template.querySelector('iframe');
        if (iframe) {
            const currentSrc = iframe.src;
            iframe.src = '';
            setTimeout(() => {
                iframe.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'retry=' + Date.now();
            }, 100);
        }
    }
    
    // Computed properties
    get iframeStyle() {
        return `height: ${this.height}px; width: 100%; border: none; border-radius: 8px;`;
    }
    
    get containerClass() {
        return `chat-iframe-container ${this.hasError ? 'has-error' : ''}`;
    }
    
    get showRetryButton() {
        return this.hasError && !this.isLoading;
    }
    
    get loadingMessage() {
        return 'Loading chat interface...';
    }
    
    // Build iframe URL with optional parameters
    get iframeSrc() {
        let url = this.chatUrl;
        
        // Add Salesforce context as URL parameters (for future use)
        if (this.currentUser) {
            const params = new URLSearchParams();
            params.set('sf_user_id', this.userId);
            params.set('sf_user_name', getFieldValue(this.currentUser, USER_NAME_FIELD) || '');
            params.set('sf_user_email', getFieldValue(this.currentUser, USER_EMAIL_FIELD) || '');
            params.set('timestamp', Date.now().toString());
            
            url += (url.includes('?') ? '&' : '?') + params.toString();
        }
        
        return url;
    }
}