import { db, handleFirestoreError, OperationType } from './firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export interface ChatSpace {
  name: string; // e.g. "spaces/AAAAAAAAAAA"
  displayName?: string;
  type?: string;
  spaceType?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE';
  singleUserBotDm?: boolean;
}

export interface ChatMessage {
  name: string;
  text: string;
  createTime?: string;
  sender?: {
    name?: string;
    displayName?: string;
    avatarUrl?: string;
    type?: string;
  };
}

export interface ChatApiError {
  isConfigError: boolean;
  message: string;
  configUrl: string;
}

const PROJECT_ID = (firebaseConfig as any).projectId || 'tenderxpo';
export const CHAT_CONSOLE_CONFIG_URL = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${PROJECT_ID}`;

/**
 * Parses response errors to detect unconfigured Google Chat apps
 */
function handleChatResponseError(status: number, data: any): never {
  const errMsg = data?.error?.message || data?.message || 'Google Chat API error';
  const isAppNotConfigured =
    status === 404 ||
    errMsg.toLowerCase().includes('google chat app not found') ||
    errMsg.toLowerCase().includes('configure the app in the google cloud console');

  const errorObj = new Error(errMsg) as any;
  errorObj.status = status;
  errorObj.isConfigError = isAppNotConfigured;
  errorObj.configUrl = CHAT_CONSOLE_CONFIG_URL;
  throw errorObj;
}

/**
 * List Google Chat Spaces accessible by the current authenticated user
 */
export async function listChatSpaces(accessToken: string): Promise<ChatSpace[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    handleChatResponseError(res.status, data);
  }

  return data.spaces || [];
}

/**
 * List recent messages inside a space
 */
export async function listSpaceMessages(
  accessToken: string,
  spaceName: string,
  pageSize: number = 20
): Promise<ChatMessage[]> {
  const res = await fetch(
    `https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=${pageSize}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    handleChatResponseError(res.status, data);
  }

  return (data.messages || []).reverse();
}

/**
 * Create a new collaboration space for a bid
 */
export async function createChatSpace(
  accessToken: string,
  displayName: string
): Promise<ChatSpace> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      displayName: displayName.slice(0, 128),
      spaceType: 'SPACE',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    handleChatResponseError(res.status, data);
  }

  return data;
}

/**
 * Post a text or structured message to a space
 */
export async function sendMessageToSpace(
  accessToken: string,
  spaceName: string,
  text: string,
  senderUid?: string,
  tenderId?: string
): Promise<ChatMessage> {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    handleChatResponseError(res.status, data);
  }

  // Persist record to Firestore for audit trail and compliance
  if (senderUid) {
    try {
      await addDoc(collection(db, 'chat_notifications'), {
        spaceId: spaceName.slice(0, 256),
        tenderId: tenderId || 'general-notice',
        message: text.slice(0, 4000),
        sentBy: senderUid,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Could not record chat notification in Firestore:', err);
      // Non-fatal for client message delivery
    }
  }

  return data;
}
