import { useMemo, useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Conversation, ChatMessage } from '../database';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    model?: string;
}

export interface UseConversationsReturn {
    // Conversations List
    conversations: Conversation[];
    activeConversation: Conversation | null;

    // Actions
    createConversation: (persona: string) => Promise<number>;
    loadConversation: (id: number) => void;
    deleteConversation: (id: number) => Promise<void>;
    renameConversation: (id: number, title: string) => Promise<void>;

    // Messages
    messages: Message[];
    addMessage: (message: Message) => Promise<void>;
    clearMessages: () => Promise<void>;

    // State
    isLoading: boolean;
}

export function useConversations(initialPersona: string = 'advisor'): UseConversationsReturn {
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch all conversations for this persona
    const conversations = useLiveQuery(
        () => db.conversations
            .where('persona')
            .equals(initialPersona)
            .reverse()
            .sortBy('updatedAt'),
        [initialPersona]
    ) || [];

    // Fetch active conversation
    const activeConversation = useLiveQuery(
        () => activeConversationId
            ? db.conversations.get(activeConversationId)
            : undefined,
        [activeConversationId]
    ) || null;

    // Fetch messages for active conversation
    const chatMessages = useLiveQuery(
        () => activeConversationId
            ? db.chat_messages
                .where('conversationId')
                .equals(activeConversationId)
                .sortBy('timestamp')
            : [],
        [activeConversationId]
    ) || [];

    // Convert ChatMessage to Message format
    const messages = useMemo<Message[]>(() =>
        chatMessages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            imageUrl: m.imageUrl,
            model: m.model
        })),
        [chatMessages]
    );

    // Create new conversation
    const createConversation = useCallback(async (persona: string): Promise<number> => {
        const now = new Date().toISOString();
        const id = await db.conversations.add({
            title: `New Chat ${new Date().toLocaleDateString()}`,
            persona,
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
            preview: ''
        });
        setActiveConversationId(id as number);
        return id as number;
    }, []);

    // Load existing conversation
    const loadConversation = useCallback((id: number) => {
        setActiveConversationId(id);
    }, []);

    // Delete conversation and its messages
    const deleteConversation = useCallback(async (id: number) => {
        await db.transaction('rw', db.conversations, db.chat_messages, async () => {
            await db.chat_messages.where('conversationId').equals(id).delete();
            await db.conversations.delete(id);
        });
        if (activeConversationId === id) {
            setActiveConversationId(null);
        }
    }, [activeConversationId]);

    // Rename conversation
    const renameConversation = useCallback(async (id: number, title: string) => {
        await db.conversations.update(id, { title });
    }, []);

    // Add message to active conversation
    const addMessage = useCallback(async (message: Message) => {
        if (!activeConversationId) {
            const id = await createConversation(initialPersona);
            setActiveConversationId(id);
        }

        const convId = activeConversationId || 1;
        const now = new Date().toISOString();

        await db.chat_messages.add({
            conversationId: convId,
            role: message.role,
            content: message.content,
            timestamp: now,
            model: message.model,
            imageUrl: message.imageUrl
        });

        // Update conversation metadata
        const conv = await db.conversations.get(convId);
        if (conv) {
            await db.conversations.update(convId, {
                updatedAt: now,
                messageCount: (conv.messageCount || 0) + 1,
                preview: message.content.slice(0, 100)
            });

            // Auto-rename on first message
            if (conv.messageCount === 0 && message.role === 'user') {
                const autoTitle = message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '');
                await db.conversations.update(convId, { title: autoTitle });
            }
        }
    }, [activeConversationId, createConversation, initialPersona]);

    // Clear all messages in active conversation
    const clearMessages = useCallback(async () => {
        if (activeConversationId) {
            await db.chat_messages.where('conversationId').equals(activeConversationId).delete();
            await db.conversations.update(activeConversationId, {
                messageCount: 0,
                preview: '',
                updatedAt: new Date().toISOString()
            });
        }
    }, [activeConversationId]);

    return {
        conversations,
        activeConversation,
        createConversation,
        loadConversation,
        deleteConversation,
        renameConversation,
        messages,
        addMessage,
        clearMessages,
        isLoading
    };
}

export default useConversations;
