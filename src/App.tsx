import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  BookOpen, 
  MessageSquare, 
  Lightbulb, 
  CheckCircle2, 
  ListOrdered, 
  BrainCircuit,
  X,
  Loader2,
  Send,
  ChevronRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { generateNotebookContent, chatWithNotebook } from './services/geminiService';

interface Source {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  content: string; // Text for PDF, base64 for image
  mimeType?: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'quiz' | 'steps' | 'conclusion'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({
    summary: '',
    quiz: '',
    steps: '',
    conclusion: ''
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    for (const file of Array.from(files)) {
      try {
        if (file.type === 'application/pdf') {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/extract-pdf', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          setSources(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: 'pdf',
            content: data.text
          }]);
        } else if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setSources(prev => [...prev, {
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              type: 'image',
              content: event.target?.result as string,
              mimeType: file.type
            }]);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatWithNotebook(
        messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        userMsg,
        sources.map(s => ({ 
          type: s.type === 'pdf' ? 'text' : 'image', 
          content: s.content,
          mimeType: s.mimeType
        }))
      );
      setMessages(prev => [...prev, { role: 'model', text: response || 'No response from AI.' }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: 'model', text: 'Error communicating with AI.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const runAiAction = async (action: 'summary' | 'quiz' | 'steps' | 'conclusion') => {
    if (sources.length === 0 || isLoading) return;
    
    setIsLoading(true);
    setActiveTab(action);

    const prompts = {
      summary: "Provide a comprehensive summary of these sources, highlighting key themes and important details.",
      quiz: "Generate a 5-question multiple-choice quiz based on these sources to test my understanding. Include answers at the end.",
      steps: "Break down the main processes or concepts in these sources into a clear, step-by-step guide.",
      conclusion: "What are the primary conclusions or takeaways from these materials?"
    };

    try {
      const response = await generateNotebookContent(
        prompts[action],
        sources.map(s => ({ 
          type: s.type === 'pdf' ? 'text' : 'image', 
          content: s.content,
          mimeType: s.mimeType
        }))
      );
      setAiResponses(prev => ({ ...prev, [action]: response || '' }));
    } catch (err) {
      console.error(`${action} error:`, err);
      setAiResponses(prev => ({ ...prev, [action]: 'Error generating content.' }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F9F9F9] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Sidebar - Sources */}
      <aside className="w-80 border-r border-gray-200 bg-white flex flex-col shadow-sm">
        <div className="p-6 border-bottom border-gray-100">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">AI Analyzer LLM</h1>
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition-all border border-blue-200 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            Add Sources
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept=".pdf,image/*" 
            className="hidden" 
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          <h2 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">My Sources</h2>
          {isUploading && (
            <div className="flex items-center gap-3 p-3 text-sm text-gray-500 animate-pulse">
              <Loader2 className="animate-spin" size={16} />
              Processing files...
            </div>
          )}
          {sources.length === 0 && !isUploading && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                <Upload size={20} />
              </div>
              <p className="text-sm text-gray-400">No sources yet. Upload a PDF or Image to start.</p>
            </div>
          )}
          {sources.map(source => (
            <div 
              key={source.id} 
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-default"
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                source.type === 'pdf' ? "bg-orange-50 text-orange-600" : "bg-purple-50 text-purple-600"
              )}>
                {source.type === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.name}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold">{source.type}</p>
              </div>
              <button 
                onClick={() => removeSource(source.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 rounded-md transition-all text-gray-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600" />
            <div className="text-xs">
              <p className="font-bold text-gray-700">AI Specialist Mode</p>
              <p className="text-gray-400">Gemini 3 Flash</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Top Navigation */}
        <nav className="h-16 border-b border-gray-200 bg-white flex items-center px-8 gap-8">
          {[
            { id: 'chat', label: 'Chat', icon: MessageSquare },
            { id: 'summary', label: 'Summary', icon: FileText },
            { id: 'quiz', label: 'Quiz', icon: BrainCircuit },
            { id: 'steps', label: 'Steps', icon: ListOrdered },
            { id: 'conclusion', label: 'Conclusion', icon: CheckCircle2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'chat' ? setActiveTab('chat') : runAiAction(tab.id as any)}
              className={cn(
                "flex items-center gap-2 text-sm font-semibold h-full border-b-2 transition-all px-1",
                activeTab === tab.id 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' ? (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col bg-white"
              >
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                        <Lightbulb size={32} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Ask anything about your sources</h3>
                      <p className="text-gray-500">
                        I can help you understand complex topics, find specific details, or synthesize information across all your uploaded documents.
                      </p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={cn(
                      "flex gap-4 max-w-3xl",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                        msg.role === 'user' ? "bg-gray-100 text-gray-600" : "bg-blue-600 text-white"
                      )}>
                        {msg.role === 'user' ? <ChevronRight size={16} /> : <BrainCircuit size={16} />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                        msg.role === 'user' ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-800 border border-gray-100"
                      )}>
                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && activeTab === 'chat' && (
                    <div className="flex gap-4 max-w-3xl mr-auto animate-pulse">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Loader2 className="animate-spin text-blue-600" size={16} />
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 w-32 h-12" />
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-gray-100 bg-white">
                  <div className="max-w-4xl mx-auto relative">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={sources.length > 0 ? "Ask a question about your sources..." : "Upload sources to start chatting"}
                      disabled={sources.length === 0 || isLoading}
                      className="w-full pl-6 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading || sources.length === 0}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 overflow-y-auto p-12 bg-white"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      {activeTab === 'summary' && <FileText size={24} />}
                      {activeTab === 'quiz' && <BrainCircuit size={24} />}
                      {activeTab === 'steps' && <ListOrdered size={24} />}
                      {activeTab === 'conclusion' && <CheckCircle2 size={24} />}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold capitalize">{activeTab}</h2>
                      <p className="text-gray-500">AI-generated based on your current sources</p>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
                      <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse" />
                      <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse" />
                    </div>
                  ) : aiResponses[activeTab] ? (
                    <div className="prose prose-blue max-w-none bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                      <Markdown>{aiResponses[activeTab]}</Markdown>
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      <p className="text-gray-400">Click the tab again to generate content.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
