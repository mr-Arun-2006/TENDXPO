import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  ChatSpace,
  ChatMessage,
  listChatSpaces,
  listSpaceMessages,
  sendMessageToSpace,
  createChatSpace,
  CHAT_CONSOLE_CONFIG_URL,
} from '../services/googleChat';
import { connectGoogleChat, logout } from '../services/firebase';
import { Tender } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  MessageSquare,
  X,
  Send,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Users,
  CheckCircle2,
  FileText,
  TrendingUp,
  Shield,
  Building,
  HelpCircle,
  LogOut,
} from 'lucide-react';

interface GoogleChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onAuthSuccess: (user: User, token: string) => void;
  onAuthLogout: () => void;
  activeTender?: Tender | null;
}

export const GoogleChatModal: React.FC<GoogleChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onAuthSuccess,
  onAuthLogout,
  activeTender,
}) => {
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorNotice, setErrorNotice] = useState<{ message: string; isConfigError?: boolean } | null>(null);

  // Confirmation modal states (Workspace requirement: mandatory confirmation for destructive/send actions)
  const [pendingAction, setPendingAction] = useState<{
    type: 'send_message' | 'create_space';
    payload: any;
  } | null>(null);

  // New Space modal state
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');

  // Fetch spaces when authenticated
  const fetchSpaces = async () => {
    if (!accessToken) return;
    setIsLoadingSpaces(true);
    setErrorNotice(null);
    try {
      const fetchedSpaces = await listChatSpaces(accessToken);
      setSpaces(fetchedSpaces);
      if (fetchedSpaces.length > 0 && !selectedSpace) {
        setSelectedSpace(fetchedSpaces[0]);
      }
    } catch (err: any) {
      console.error('Failed to list Google Chat spaces:', err);
      setErrorNotice({
        message: err.message || 'Failed to load Google Chat spaces.',
        isConfigError: err.isConfigError,
      });
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  // Fetch messages when a space is selected
  const fetchMessages = async (space: ChatSpace) => {
    if (!accessToken) return;
    setIsLoadingMessages(true);
    setErrorNotice(null);
    try {
      const msgs = await listSpaceMessages(accessToken, space.name);
      setMessages(msgs);
    } catch (err: any) {
      console.error('Failed to list space messages:', err);
      setErrorNotice({
        message: err.message || 'Failed to fetch messages for this space.',
        isConfigError: err.isConfigError,
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isOpen && accessToken) {
      fetchSpaces();
    }
  }, [isOpen, accessToken]);

  useEffect(() => {
    if (selectedSpace && accessToken) {
      fetchMessages(selectedSpace);
    }
  }, [selectedSpace, accessToken]);

  if (!isOpen) return null;

  // Sign In with Google
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorNotice(null);
    try {
      const result = await connectGoogleChat();
      if (result) {
        onAuthSuccess(result.user, result.accessToken);
      }
    } catch (err: any) {
      const errorCode = err?.code || '';
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorCode === 'auth/user-cancelled'
      ) {
        return;
      }
      setErrorNotice({
        message: err.message || 'Google Sign-in failed. Please retry.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await logout();
    onAuthLogout();
    setSpaces([]);
    setSelectedSpace(null);
    setMessages([]);
  };

  // Trigger Confirmation for sending message
  const handleInitiateSend = (text: string) => {
    if (!text.trim() || !selectedSpace) return;
    setPendingAction({
      type: 'send_message',
      payload: { text, space: selectedSpace },
    });
  };

  // Trigger Confirmation for creating space
  const handleInitiateCreateSpace = () => {
    if (!newSpaceName.trim()) return;
    setPendingAction({
      type: 'create_space',
      payload: { name: newSpaceName.trim() },
    });
  };

  // Execute confirmed action
  const handleExecuteConfirmedAction = async () => {
    if (!pendingAction || !accessToken) return;
    const action = pendingAction;
    setPendingAction(null);

    if (action.type === 'send_message') {
      setIsSending(true);
      try {
        await sendMessageToSpace(
          accessToken,
          action.payload.space.name,
          action.payload.text,
          currentUser?.uid,
          activeTender?.id
        );
        setMessageInput('');
        fetchMessages(action.payload.space);
      } catch (err: any) {
        setErrorNotice({
          message: err.message || 'Failed to post message to Google Chat.',
          isConfigError: err.isConfigError,
        });
      } finally {
        setIsSending(false);
      }
    } else if (action.type === 'create_space') {
      setIsLoadingSpaces(true);
      try {
        const created = await createChatSpace(accessToken, action.payload.name);
        setNewSpaceName('');
        setShowCreateSpaceModal(false);
        await fetchSpaces();
        setSelectedSpace(created);
      } catch (err: any) {
        setErrorNotice({
          message: err.message || 'Failed to create Google Chat space.',
          isConfigError: err.isConfigError,
        });
      } finally {
        setIsLoadingSpaces(false);
      }
    }
  };

  // Pre-fill tender summary alert
  const injectTenderSummaryMessage = () => {
    if (!activeTender) return;
    const alertText = `🚨 *TenDo Tender Intelligence Alert* 🚨\n\n📌 *Title:* ${activeTender.title}\n🏛 *Authority:* ${activeTender.authority} (${activeTender.portal})\n💰 *Estimated Budget:* ${formatCurrency(activeTender.budget, 'INR')}\n⏱ *Submission Deadline:* ${activeTender.submissionDeadline}\n🎯 *Company Fit Score:* ${activeTender.companyFitScore}%\n⚖️ *Feasibility:* ${activeTender.feasibilityVerdict}\n\n_Team recommendation: Initiate BOQ costing model & joint JV proposal review._`;
    setMessageInput(alertText);
  };

  // Pre-fill raw material price alert
  const injectCommodityPriceAlert = () => {
    const alertText = `⚠️ *Raw Material Volatility Notice (Indian Markets)* ⚠️\n\n• Fe550D TMT Reinforcement Steel: ₹62,000/MT (+4.8% 7d surge)\n• OPC 53 Grade Cement: ₹385/bag (stable domestic supply)\n• Commercial Diesel Freight: ₹94/L (+3.1% transport index)\n\n_Advise updating cost escalation contingency buffer by +3.5% on active building construction bids._`;
    setMessageInput(alertText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f] text-white flex items-center justify-center shadow-md shadow-[#4d6b2f]/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-stone-900 text-base sm:text-lg">
                  Google Chat Integration
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/30">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Real-time bid war room collaboration, team alerts, and tender notification dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-full border border-stone-200 text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#4d6b2f] text-white flex items-center justify-center text-[10px] font-bold">
                    {currentUser.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="font-semibold text-stone-800 max-w-[120px] truncate hidden sm:inline">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-stone-400 hover:text-stone-700 ml-1 p-0.5 rounded"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[460px]">
          {/* If NOT Authenticated: Show official Sign in with Google */}
          {!currentUser || !accessToken ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-[#4d6b2f]/10 text-[#4d6b2f] flex items-center justify-center shadow-inner">
                <Users className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-2">
                <h4 className="text-lg font-extrabold text-stone-900">
                  Connect Your Google Workspace Account
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Sign in with your Google account to access Google Chat spaces, collaborate with your bidding team, and dispatch real-time government tender updates directly into chat channels.
                </p>
              </div>

              {/* Official Google Sign-In Button */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isLoggingIn}
                className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm shadow-xs transition hover:shadow active:scale-95 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>
                  {isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}
                </span>
              </button>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-[11px] text-stone-500 max-w-sm text-left flex items-start gap-2">
                <Shield className="w-4 h-4 text-[#4d6b2f] shrink-0 mt-0.5" />
                <span>
                  Access tokens are managed securely in-memory and used strictly for Google Chat space messaging with your explicit consent.
                </span>
              </div>
            </div>
          ) : (
            /* Authenticated View: Spaces Sidebar + Message Stream */
            <>
              {/* Left Sidebar: Spaces List */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-stone-200 bg-stone-50/60 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200">
                    <span className="text-xs font-black uppercase text-stone-500 tracking-wider">
                      Chat Spaces
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={fetchSpaces}
                        disabled={isLoadingSpaces}
                        className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition"
                        title="Refresh spaces"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSpaces ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowCreateSpaceModal(true)}
                        className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition"
                        title="Create new Google Chat space"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isLoadingSpaces ? (
                    <div className="py-8 text-center text-xs text-stone-400">Loading spaces...</div>
                  ) : spaces.length === 0 ? (
                    <div className="py-6 px-3 text-center space-y-2">
                      <p className="text-xs text-stone-500 font-medium">No active chat spaces found.</p>
                      <button
                        onClick={() => setShowCreateSpaceModal(true)}
                        className="text-xs text-[#3f5724] font-bold underline"
                      >
                        Create a Bid War Room Space
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[300px] md:max-h-[380px] overflow-y-auto">
                      {spaces.map((space) => {
                        const isSelected = selectedSpace?.name === space.name;
                        return (
                          <button
                            key={space.name}
                            onClick={() => setSelectedSpace(space)}
                            className={`w-full text-left p-2.5 rounded-xl text-xs transition flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-[#4d6b2f] text-white font-bold shadow-xs'
                                : 'hover:bg-stone-200/70 text-stone-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Users className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-stone-500'}`} />
                              <span className="truncate">{space.displayName || 'Unnamed Space'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-stone-200">
                  <button
                    onClick={() => setShowCreateSpaceModal(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-stone-200 hover:border-[#4d6b2f] text-[#3f5724] text-xs font-bold transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Bid Space</span>
                  </button>
                </div>
              </div>

              {/* Right Panel: Messages & Composer */}
              <div className="flex-1 flex flex-col justify-between p-4 bg-white overflow-hidden">
                {/* Active Space Banner & Quick Template Chips */}
                <div className="pb-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
                      <span>{selectedSpace?.displayName || 'Select a Space'}</span>
                      {selectedSpace && (
                        <span className="text-[10px] font-mono text-stone-400">
                          {selectedSpace.name}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      Messages posted here sync directly to Google Chat app for all room members.
                    </p>
                  </div>

                  {/* Dispatch Templates */}
                  <div className="flex items-center gap-1.5">
                    {activeTender && (
                      <button
                        onClick={injectTenderSummaryMessage}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4d6b2f]/10 hover:bg-[#4d6b2f]/20 text-[#3f5724] text-[11px] font-bold border border-[#4d6b2f]/20 transition"
                        title="Pre-fill active tender details into composer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Insert Tender Summary</span>
                      </button>
                    )}
                    <button
                      onClick={injectCommodityPriceAlert}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 transition"
                      title="Pre-fill raw materials alert"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>Insert Price Alert</span>
                    </button>
                  </div>
                </div>

                {/* Notice / Google Cloud Configuration Alert if 404 */}
                {errorNotice && (
                  <div
                    className={`my-3 p-3.5 rounded-2xl border text-xs ${
                      errorNotice.isConfigError
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">
                          {errorNotice.isConfigError
                            ? 'Google Chat App Setup Required in Google Cloud'
                            : 'Google Chat Notice'}
                        </p>
                        <p className="leading-relaxed text-[11px]">{errorNotice.message}</p>
                        {errorNotice.isConfigError && (
                          <div className="pt-1">
                            <a
                              href={CHAT_CONSOLE_CONFIG_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-900 underline hover:text-amber-950"
                            >
                              <span>Configure Google Chat App in Cloud Console</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              (One-time step: Fill in App Name & Description, then refresh this modal).
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                  {isLoadingMessages ? (
                    <div className="h-48 flex items-center justify-center text-xs text-stone-400">
                      Loading conversation messages...
                    </div>
                  ) : !selectedSpace ? (
                    <div className="h-48 flex items-center justify-center text-xs text-stone-400 italic">
                      Please select or create a space to view messages.
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-stone-400 space-y-1">
                      <MessageSquare className="w-8 h-8 opacity-40" />
                      <p className="text-xs font-semibold text-stone-500">No messages in this space yet.</p>
                      <p className="text-[11px] text-stone-400">
                        Dispatch a tender briefing or type below to notify your bid engineering team.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.name}
                        className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-stone-800">
                            {msg.sender?.displayName || 'Google Chat Member'}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {msg.createTime ? new Date(msg.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-stone-700 whitespace-pre-wrap leading-relaxed font-sans">
                          {msg.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Composer */}
                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={
                        selectedSpace
                          ? `Post an update or tender notice to ${selectedSpace.displayName || 'space'}...`
                          : 'Select a space to compose message...'
                      }
                      disabled={!selectedSpace || isSending}
                      rows={2}
                      className="flex-1 p-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#4d6b2f] resize-none"
                    />
                    <button
                      onClick={() => handleInitiateSend(messageInput)}
                      disabled={!messageInput.trim() || !selectedSpace || isSending}
                      className="px-4 py-3 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs transition shadow-xs active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-400 px-1">
                    <span>Markdown supported (*bold*, _italic_, bullet points)</span>
                    <span>Audit copy recorded in Firebase Firestore</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog (Mandatory per Workspace Skill for Sending/Mutating Data) */}
      {pendingAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-950/70 p-4">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#4d6b2f] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  {pendingAction.type === 'send_message'
                    ? 'Confirm Message Dispatch'
                    : 'Confirm Space Creation'}
                </h4>
                <p className="text-xs text-stone-500">
                  Google Workspace User Confirmation
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-700 space-y-2">
              {pendingAction.type === 'send_message' ? (
                <>
                  <p className="font-semibold text-stone-800">
                    Post message to Google Chat Space:
                    <span className="text-[#3f5724] font-bold block mt-0.5">
                      "{pendingAction.payload.space.displayName || pendingAction.payload.space.name}"
                    </span>
                  </p>
                  <div className="p-2.5 rounded-xl bg-white border border-stone-200 text-[11px] text-stone-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {pendingAction.payload.text}
                  </div>
                </>
              ) : (
                <p>
                  Create new Google Chat collaboration room:
                  <span className="font-bold text-stone-900 block mt-1">
                    "{pendingAction.payload.name}"
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                className="px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs transition shadow-xs"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Space Modal */}
      {showCreateSpaceModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-950/70 p-4">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-stone-900 text-base">
                Create Google Chat Space
              </h4>
              <button
                onClick={() => setShowCreateSpaceModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Create a dedicated collaboration room in Google Chat for your bid proposal committee.
            </p>
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Space Display Name
              </label>
              <input
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="e.g., CPWD Building Bid War Room"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-[#4d6b2f]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateSpaceModal(false)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateCreateSpace}
                disabled={!newSpaceName.trim()}
                className="px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs transition disabled:opacity-40"
              >
                Create Space
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
