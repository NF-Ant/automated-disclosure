import { LightningElement, track } from 'lwc';

export default class AiChatInterface extends LightningElement {
    @track inputValue = '';
    @track isConnected = false;
    @track isTyping = false;
    @track errorMessage = '';
    @track statusText = 'Connecting...';
    
    ws = null;
    wsUrl = 'wss://op0nesemea.execute-api.us-west-2.amazonaws.com/dev';

    get statusIndicatorClass() {
        return `status-indicator ${this.isConnected ? 'connected' : ''}`;
    }

    get isSendDisabled() {
        return !this.inputValue.trim() || !this.isConnected;
    }

    connectedCallback() {
        this.initializeChat();
        this.connectWebSocket();
    }

    disconnectedCallback() {
        if (this.ws) {
            this.ws.close();
        }
    }

    initializeChat() {
        // Add model info
        setTimeout(() => {
            this.addSystemMessage('Powered by Claude via AWS Bedrock');
        }, 100);
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.statusText = 'Connected';
                this.hideError();
                
                // Send welcome message
                setTimeout(() => {
                    this.addMessage('assistant', 'Hello! I\'m your AI assistant powered by Claude. How can I help you today?');
                }, 500);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            this.ws.onclose = (event) => {
                this.isConnected = false;
                this.statusText = 'Disconnected';
                
                if (event.code !== 1000) {
                    this.showError('Connection lost. Please refresh to reconnect.');
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showError('Connection error. Please check your connection and try again.');
            };

        } catch (error) {
            console.error('Failed to connect:', error);
            this.showError('Failed to connect to the chat service.');
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'chat_response':
            case 'bedrock_response':
            case 'rag_response':
                this.hideTypingIndicator();
                this.addMessage('assistant', data.message);
                
                // Show sources if available
                if (data.sources && data.sources.length > 0) {
                    this.showSources(data.sources);
                }
                break;
                
            case 'error':
                this.hideTypingIndicator();
                this.showError(data.message);
                break;
                
            case 'pong':
                console.log('Received pong');
                break;
                
            default:
                console.log('Unknown message type:', data);
        }
    }

    handleInputChange(event) {
        this.inputValue = event.target.value;
        
        // Auto-resize textarea
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    sendMessage() {
        const message = this.inputValue.trim();
        
        if (!message || !this.isConnected) return;

        // Add user message to chat
        this.addMessage('user', message);
        
        // Clear input
        this.inputValue = '';
        const textarea = this.template.querySelector('.chat-input');
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.value = '';
        }

        // Show typing indicator
        this.showTypingIndicator();

        // Send message via WebSocket
        try {
            this.ws.send(JSON.stringify({
                type: 'chat',
                message: message
            }));
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.showError('Failed to send message. Please try again.');
        }
    }

    addMessage(sender, content) {
        const messagesContainer = this.template.querySelector('.chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${sender === 'user' ? 'You' : 'AI'}</div>
            <div class="message-content">
                ${this.escapeHtml(content)}
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(content) {
        const messagesContainer = this.template.querySelector('.chat-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.innerHTML = `
            <div class="system-content">${this.escapeHtml(content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const messagesContainer = this.template.querySelector('.chat-messages');
        if (!messagesContainer) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        typingDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = this.template.querySelector('#typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }

    showSources(sources) {
        if (!sources || sources.length === 0) return;
        
        const sourcesText = sources.map(source => {
            if (source.title) {
                return `📄 ${source.title}`;
            } else if (source.id) {
                return `📄 Article ${source.id}`;
            }
            return '📄 Knowledge Article';
        }).join('\n');
        
        this.addSystemMessage(`Sources used:\n${sourcesText}`);
    }

    showError(message) {
        this.errorMessage = message;
        setTimeout(() => {
            this.errorMessage = '';
        }, 5000);
    }

    hideError() {
        this.errorMessage = '';
    }

    scrollToBottom() {
        const messagesContainer = this.template.querySelector('.chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}