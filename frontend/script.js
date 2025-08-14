class RAGChat {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.conversationHistory = [];
        this.initializeElements();
        this.attachEventListeners();
        this.loadStatus();
        this.loadDocuments();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.uploadBtn = document.getElementById('upload-btn');
        this.documentsList = document.getElementById('documents-list');
        this.clearDocsBtn = document.getElementById('clear-docs-btn');
        this.chatMessages = document.getElementById('chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.sendText = document.getElementById('send-text');
        this.sendSpinner = document.getElementById('send-spinner');
        this.newConversationBtn = document.getElementById('new-conversation-btn');
        this.modeIndicator = document.getElementById('mode-indicator');
        this.tokenCount = document.getElementById('token-count');
        this.documentCount = document.getElementById('document-count');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.modeSwitchModal = document.getElementById('mode-switch-modal');
        this.modalTokenCount = document.getElementById('modal-token-count');
        this.documentPreviewModal = document.getElementById('document-preview-modal');
        this.documentPreviewTitle = document.getElementById('document-preview-title');
        this.previewTokenCount = document.getElementById('preview-token-count');
        this.previewUploadTime = document.getElementById('preview-upload-time');
        this.previewContentLength = document.getElementById('preview-content-length');
        this.documentPreviewContent = document.getElementById('document-preview-content');
    }

    attachEventListeners() {
        // File upload
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        
        // Drag and drop
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Chat
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Clear documents
        this.clearDocsBtn.addEventListener('click', () => this.clearDocuments());
        
        // New conversation
        this.newConversationBtn.addEventListener('click', () => this.newConversation());
        
        // Modal keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const chunkModal = document.getElementById('chunk-modal');
                if (chunkModal && chunkModal.classList.contains('show')) {
                    this.closeChunkModal();
                } else if (this.modeSwitchModal.classList.contains('show')) {
                    this.closeModal();
                } else if (this.documentPreviewModal.classList.contains('show')) {
                    this.closeDocumentPreview();
                }
            }
        });
        
        // Close modal when clicking outside
        this.modeSwitchModal.addEventListener('click', (e) => {
            if (e.target === this.modeSwitchModal) {
                this.closeModal();
            }
        });
        
        this.documentPreviewModal.addEventListener('click', (e) => {
            if (e.target === this.documentPreviewModal) {
                this.closeDocumentPreview();
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        this.handleFileSelect(e.dataTransfer.files);
    }

    async handleFileSelect(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
        this.loadDocuments();
        this.loadStatus();
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        // Show upload progress message
        const uploadMessage = this.showUploadProgress(file.name);

        try {
            const response = await fetch(`${this.apiBase}/upload-document`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }

            const result = await response.json();
            
            // Remove upload progress message
            this.removeUploadProgress(uploadMessage);
            
            this.showMessage(`✅ Uploaded "${result.name}" (${result.token_count} tokens)`, 'system');
            
            // Show modal if mode switched to RAG
            if (result.mode_switched_to_rag) {
                this.showModeSwitchModal(result.total_tokens);
            }
        } catch (error) {
            // Remove upload progress message on error
            this.removeUploadProgress(uploadMessage);
            this.showMessage(`❌ Failed to upload "${file.name}": ${error.message}`, 'system', true);
        }
    }
    
    showUploadProgress(fileName) {
        const uploadDiv = document.createElement('div');
        uploadDiv.className = 'message system-message upload-progress';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="upload-spinner"></div>
            <span>Uploading "${fileName}"...</span>
        `;
        
        uploadDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(uploadDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return uploadDiv;
    }
    
    removeUploadProgress(uploadMessage) {
        if (uploadMessage && uploadMessage.parentNode) {
            uploadMessage.parentNode.removeChild(uploadMessage);
        }
    }

    async loadDocuments() {
        try {
            const response = await fetch(`${this.apiBase}/documents`);
            const data = await response.json();

            if (data.documents.length === 0) {
                this.documentsList.innerHTML = '<p class="empty-state">No documents uploaded yet</p>';
            } else {
                this.documentsList.innerHTML = data.documents.map(doc => `
                    <div class="document-item">
                        <div class="document-info">
                            <div class="document-name clickable" onclick="window.ragChat.showDocumentPreview('${doc.id}')" title="Click to preview document">${doc.name}</div>
                            <div class="document-meta">${doc.token_count} tokens • Uploaded ${new Date(doc.upload_time).toLocaleString()}</div>
                        </div>
                        <button class="delete-btn" onclick="window.ragChat.deleteDocument('${doc.id}')">×</button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    }

    async deleteDocument(documentId) {
        try {
            const response = await fetch(`${this.apiBase}/documents/${documentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadDocuments();
                this.loadStatus();
                this.showMessage('Document deleted', 'system');
            }
        } catch (error) {
            this.showMessage('Failed to delete document', 'system', true);
        }
    }

    async clearDocuments() {
        if (!confirm('Are you sure you want to clear all documents?')) return;

        try {
            const response = await fetch(`${this.apiBase}/documents`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadDocuments();
                this.loadStatus();
                this.conversationHistory = [];
                this.showMessage('All documents cleared', 'system');
            }
        } catch (error) {
            this.showMessage('Failed to clear documents', 'system', true);
        }
    }

    async loadStatus() {
        try {
            const response = await fetch(`${this.apiBase}/status`);
            const status = await response.json();

            this.modeIndicator.textContent = `Mode: ${status.current_mode.replace('_', ' ').toUpperCase()}`;
            this.modeIndicator.className = status.current_mode === 'rag' ? 'rag-mode' : 'full-context-mode';
            this.tokenCount.textContent = `Tokens: ${status.total_tokens.toLocaleString()}`;
            this.documentCount.textContent = `Documents: ${status.total_documents}`;
            
            // Update progress bar
            this.updateProgressBar(status.context_metrics);
        } catch (error) {
            console.error('Failed to load status:', error);
        }
    }

    updateProgressBar(contextMetrics) {
        const percentage = contextMetrics.context_fill_percentage;
        const used = contextMetrics.context_tokens_used.toLocaleString();
        const max = contextMetrics.max_context_tokens.toLocaleString();
        const limitType = contextMetrics.context_limit_type === 'document_limit' ? 'Full Context' : 'RAG';
        
        this.progressText.textContent = `${limitType}: ${used} / ${max} tokens (${percentage.toFixed(1)}%)`;
        this.progressBar.style.width = `${Math.min(percentage, 100)}%`;
        
        // Update color based on usage
        this.progressBar.className = 'progress-bar';
        if (percentage >= 90) {
            this.progressBar.classList.add('danger');
        } else if (percentage >= 70) {
            this.progressBar.classList.add('warning');
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.messageInput.value = '';
        this.showMessage(message, 'user');
        this.setLoading(true);
        
        // Show typing indicator
        const typingIndicator = this.showTypingIndicator();

        try {
            const response = await fetch(`${this.apiBase}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_history: this.conversationHistory
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Chat request failed');
            }

            const result = await response.json();
            
            // Remove typing indicator
            this.removeTypingIndicator(typingIndicator);
            
            // Update conversation history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: result.response }
            );

            // Show response with metadata and chunks
            let metadata = `Mode: ${result.mode.replace('_', ' ')} • ${result.relevant_chunks_count > 0 ? `${result.relevant_chunks_count} chunks retrieved • ` : ''}Context: ${result.context_tokens_used.toLocaleString()} tokens`;
            
            // Add enhanced query info if available
            if (result.enhanced_query && result.enhanced_query !== message) {
                metadata += ` • Enhanced query: "${result.enhanced_query}"`;
            }
            
            this.showMessage(result.response, 'assistant', false, metadata, result.relevant_chunks, result.mode);
            
            // Update progress bar with new context metrics
            this.updateProgressBar(result.context_metrics);

        } catch (error) {
            // Remove typing indicator on error
            this.removeTypingIndicator(typingIndicator);
            this.showMessage(`Error: ${error.message}`, 'assistant', true);
        } finally {
            this.setLoading(false);
        }
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant-message typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="typing-animation">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span class="typing-text">Assistant is thinking...</span>
        `;
        
        typingDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return typingDiv;
    }
    
    removeTypingIndicator(typingIndicator) {
        if (typingIndicator && typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
    }

    showMessage(content, type, isError = false, metadata = null, chunks = null, mode = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // Create message wrapper for content and copy button
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = `message-content ${isError ? 'error-message' : ''}`;
        contentDiv.innerHTML = this.formatMessageContent(content);
        
        messageWrapper.appendChild(contentDiv);
        
        // Add copy button for user and assistant messages (not system messages)
        if (type !== 'system' && !isError) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy message';
            copyBtn.onclick = () => this.copyMessageContent(content, copyBtn);
            messageWrapper.appendChild(copyBtn);
        }
        
        messageDiv.appendChild(messageWrapper);
        
        // Add timestamp
        const timestamp = this.formatTimestamp(new Date());
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        timestampDiv.textContent = timestamp;
        messageDiv.appendChild(timestampDiv);
        
        if (metadata) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-meta';
            metaDiv.textContent = metadata;
            messageDiv.appendChild(metaDiv);
        }
        
        // Add chunk inspector for RAG responses
        if (chunks && chunks.length > 0 && mode === 'rag') {
            // Add class to allow more space for messages with chunks
            messageDiv.classList.add('has-chunks');
            const chunkInspector = this.createChunkInspector(chunks);
            messageDiv.appendChild(chunkInspector);
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    formatTimestamp(date) {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            // Show time only for today's messages
            return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            // Show date and time for older messages
            return date.toLocaleString([], { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }
    
    async copyMessageContent(content, button) {
        try {
            await navigator.clipboard.writeText(content);
            
            // Visual feedback
            const originalContent = button.innerHTML;
            button.innerHTML = '✅';
            button.style.background = '#10b981';
            
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.style.background = '';
            }, 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            
            // Fallback for older browsers
            this.fallbackCopyTextToClipboard(content, button);
        }
    }
    
    fallbackCopyTextToClipboard(text, button) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            
            // Visual feedback
            const originalContent = button.innerHTML;
            button.innerHTML = '✅';
            button.style.background = '#10b981';
            
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.style.background = '';
            }, 1500);
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }
        
        document.body.removeChild(textArea);
    }

    createChunkInspector(chunks) {
        const inspectorDiv = document.createElement('div');
        inspectorDiv.className = 'chunk-inspector';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'chunk-inspector-header';
        headerDiv.innerHTML = `
            <span>📚 Retrieved Chunks (${chunks.length})</span>
        `;
        
        const carouselContainer = document.createElement('div');
        carouselContainer.className = 'chunk-carousel-container';
        
        const carouselWrapper = document.createElement('div');
        carouselWrapper.className = 'chunk-carousel-wrapper';
        
        const carousel = document.createElement('div');
        carousel.className = 'chunk-carousel';
        
        const carouselId = `carousel-${Date.now()}`;
        carousel.id = carouselId;
        
        // Show only first 6 chunks to prevent horizontal expansion
        const maxVisibleChunks = 6;
        const visibleChunks = chunks.slice(0, maxVisibleChunks);
        
        visibleChunks.forEach((chunk, index) => {
            const card = document.createElement('div');
            card.className = 'chunk-card';
            
            // Get preview text (first ~80 characters for more compact display)
            const plainText = chunk.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const preview = plainText.length > 80 ? plainText.substring(0, 80) + '...' : plainText;
            
            card.innerHTML = `
                <div class="chunk-card-header">
                    <div class="chunk-card-source">${chunk.document_name}</div>
                    <div class="chunk-card-score">${(chunk.similarity_score * 100).toFixed(0)}%</div>
                </div>
                <div class="chunk-card-preview">${preview}</div>
                <div class="chunk-card-footer">
                    <span class="chunk-index">Chunk ${chunk.chunk_index + 1}</span>
                    <button class="chunk-expand-btn" onclick="ragChat.showChunkModal(${chunks.indexOf(chunk)}, '${carouselId}')">
                        View Full
                    </button>
                </div>
            `;
            
            carousel.appendChild(card);
        });
        
        // Add "show more" indicator if there are more chunks
        if (chunks.length > maxVisibleChunks) {
            const moreCard = document.createElement('div');
            moreCard.className = 'chunk-card chunk-more-card';
            moreCard.innerHTML = `
                <div class="chunk-more-content">
                    <div class="chunk-more-text">+${chunks.length - maxVisibleChunks} more</div>
                    <div class="chunk-more-subtitle">Use navigation arrows to see all chunks</div>
                </div>
            `;
            carousel.appendChild(moreCard);
        }
        
        // Add navigation arrows
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-nav carousel-prev';
        prevBtn.innerHTML = '‹';
        prevBtn.onclick = () => this.scrollCarousel(carouselId, -1);
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-nav carousel-next';
        nextBtn.innerHTML = '›';
        nextBtn.onclick = () => this.scrollCarousel(carouselId, 1);
        
        carouselWrapper.appendChild(prevBtn);
        carouselWrapper.appendChild(carousel);
        carouselWrapper.appendChild(nextBtn);
        
        carouselContainer.appendChild(carouselWrapper);
        
        inspectorDiv.appendChild(headerDiv);
        inspectorDiv.appendChild(carouselContainer);
        
        // Store chunks data for modal
        inspectorDiv.chunksData = chunks;
        
        return inspectorDiv;
    }

    scrollCarousel(carouselId, direction) {
        const carousel = document.getElementById(carouselId);
        const inspector = carousel.closest('.chunk-inspector');
        const allChunks = inspector.chunksData;
        
        // If we haven't shown all chunks yet and scrolling right, show them
        if (direction > 0 && carousel.children.length < allChunks.length + 1) {
            // Clear current cards
            carousel.innerHTML = '';
            
            // Show all chunks
            allChunks.forEach((chunk, index) => {
                const card = document.createElement('div');
                card.className = 'chunk-card';
                
                const plainText = chunk.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                const preview = plainText.length > 80 ? plainText.substring(0, 80) + '...' : plainText;
                
                card.innerHTML = `
                    <div class="chunk-card-header">
                        <div class="chunk-card-source">${chunk.document_name}</div>
                        <div class="chunk-card-score">${(chunk.similarity_score * 100).toFixed(0)}%</div>
                    </div>
                    <div class="chunk-card-preview">${preview}</div>
                    <div class="chunk-card-footer">
                        <span class="chunk-index">Chunk ${chunk.chunk_index + 1}</span>
                        <button class="chunk-expand-btn" onclick="ragChat.showChunkModal(${index}, '${carouselId}')">
                            View Full
                        </button>
                    </div>
                `;
                
                carousel.appendChild(card);
            });
        }
        
        const cardWidth = carousel.querySelector('.chunk-card').offsetWidth + 8; // card width + gap
        const scrollAmount = cardWidth * direction * 2; // scroll 2 cards at a time
        
        carousel.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    }
    
    showChunkModal(chunkIndex, carouselId) {
        const carousel = document.getElementById(carouselId);
        const inspector = carousel.closest('.chunk-inspector');
        const chunks = inspector.chunksData;
        const chunk = chunks[chunkIndex];
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('chunk-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'chunk-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content chunk-modal-content">
                    <div class="modal-header">
                        <h3 id="chunk-modal-title">Chunk Details</h3>
                        <button class="modal-close" onclick="ragChat.closeChunkModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="chunk-modal-meta">
                            <div class="chunk-meta-item">
                                <span class="meta-label">Document:</span>
                                <span id="chunk-modal-document">-</span>
                            </div>
                            <div class="chunk-meta-item">
                                <span class="meta-label">Chunk:</span>
                                <span id="chunk-modal-index">-</span>
                            </div>
                            <div class="chunk-meta-item">
                                <span class="meta-label">Similarity:</span>
                                <span id="chunk-modal-score">-</span>
                            </div>
                        </div>
                        <div class="chunk-modal-content-wrapper">
                            <div id="chunk-modal-content" class="chunk-modal-text">
                                Loading...
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="ragChat.closeChunkModal()">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeChunkModal();
                }
            });
        }
        
        // Populate modal with chunk data
        document.getElementById('chunk-modal-document').textContent = chunk.document_name;
        document.getElementById('chunk-modal-index').textContent = `${chunk.chunk_index + 1}`;
        document.getElementById('chunk-modal-score').textContent = `${(chunk.similarity_score * 100).toFixed(1)}%`;
        document.getElementById('chunk-modal-content').innerHTML = this.formatMessageContent(chunk.content);
        
        // Show modal
        modal.classList.add('show');
        
        // Focus close button
        setTimeout(() => {
            const closeButton = modal.querySelector('.btn-secondary');
            if (closeButton) {
                closeButton.focus();
            }
        }, 300);
    }
    
    closeChunkModal() {
        const modal = document.getElementById('chunk-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    formatMessageContent(content) {
        // Enhanced markdown formatting
        let formatted = content;
        
        // Handle code blocks (triple backticks)
        formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => {
            const lang = language ? ` class="language-${language}"` : '';
            return `<pre><code${lang}>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // Handle inline code (single backticks)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Handle bold text
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Handle italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Handle unordered lists
        formatted = formatted.replace(/^[\s]*[-\*\+][\s]+(.*$)/gim, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Handle ordered lists
        formatted = formatted.replace(/^[\s]*\d+\.[\s]+(.*$)/gim, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, (match) => {
            // Only wrap with <ol> if not already wrapped with <ul>
            return match.includes('<ul>') ? match : `<ol>${match}</ol>`;
        });
        
        // Handle line breaks (but not inside code blocks)
        formatted = formatted.replace(/\n(?!<\/?(pre|code|ul|ol|li))/g, '<br>');
        
        return formatted;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setLoading(loading) {
        this.sendBtn.disabled = loading;
        this.sendText.style.display = loading ? 'none' : 'inline';
        this.sendSpinner.style.display = loading ? 'inline' : 'none';
        this.messageInput.disabled = loading;
    }

    showModeSwitchModal(totalTokens) {
        this.modalTokenCount.textContent = `Current tokens: ${totalTokens.toLocaleString()}`;
        this.modeSwitchModal.style.display = 'flex';
        this.modeSwitchModal.classList.add('show');
        
        // Focus the "Got it" button for accessibility
        setTimeout(() => {
            const gotItButton = this.modeSwitchModal.querySelector('.btn-primary');
            if (gotItButton) {
                gotItButton.focus();
            }
        }, 300);
    }

    closeModal() {
        this.modeSwitchModal.classList.remove('show');
        // Hide modal after transition
        setTimeout(() => {
            this.modeSwitchModal.style.display = 'none';
        }, 300);
    }
    
    async showDocumentPreview(documentId) {
        console.log('showDocumentPreview called with ID:', documentId);
        try {
            // Check if modal elements exist
            if (!this.documentPreviewModal) {
                console.error('Document preview modal not found');
                return;
            }
            
            // Show modal with loading state
            console.log('Showing modal...');
            this.documentPreviewModal.style.display = 'flex';
            this.documentPreviewModal.classList.add('show');
            this.documentPreviewTitle.textContent = 'Loading...';
            this.previewTokenCount.textContent = 'Loading...';
            this.previewUploadTime.textContent = 'Loading...'; 
            this.previewContentLength.textContent = 'Loading...';
            this.documentPreviewContent.textContent = 'Loading document preview...';
            
            console.log('Fetching document data...');
            const response = await fetch(`${this.apiBase}/documents/${documentId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to load document`);
            }
            
            const doc = await response.json();
            console.log('Document data received:', doc);
            
            // Update modal content
            this.documentPreviewTitle.textContent = doc.name;
            this.previewTokenCount.textContent = `${doc.token_count.toLocaleString()} tokens`;
            this.previewUploadTime.textContent = new Date(doc.upload_time).toLocaleString();
            this.previewContentLength.textContent = `${doc.full_content_length.toLocaleString()} characters`;
            this.documentPreviewContent.innerHTML = this.formatMessageContent(doc.content_preview);
            
            // Focus the close button for accessibility
            setTimeout(() => {
                const closeButton = this.documentPreviewModal.querySelector('.btn-secondary');
                if (closeButton) {
                    closeButton.focus();
                }
            }, 300);
        } catch (error) {
            console.error('Error in showDocumentPreview:', error);
            if (this.documentPreviewModal && this.documentPreviewModal.classList.contains('show')) {
                this.documentPreviewTitle.textContent = 'Error';
                this.documentPreviewContent.textContent = `Failed to load document: ${error.message}`;
            } else {
                alert(`Failed to load document: ${error.message}`);
            }
        }
    }
    
    closeDocumentPreview() {
        this.documentPreviewModal.classList.remove('show');
        // Hide modal after transition
        setTimeout(() => {
            this.documentPreviewModal.style.display = 'none';
        }, 300);
    }
    
    newConversation() {
        if (!confirm('Start a new conversation? This will clear the current chat history.')) return;
        
        this.conversationHistory = [];
        
        this.chatMessages.innerHTML = `
            <div class="message system-message">
                <div class="message-content">
                    <p>Welcome to the RAG Experimentation System!</p>
                    <p>Upload documents and start chatting. The system will automatically switch between full context mode (&lt;10k tokens) and RAG mode (≥10k tokens).</p>
                </div>
            </div>
        `;
        
        this.showMessage('New conversation started', 'system');
    }
}

// Initialize the app when the page loads
let ragChat;
document.addEventListener('DOMContentLoaded', () => {
    ragChat = new RAGChat();
    window.ragChat = ragChat; // Make it globally accessible
});