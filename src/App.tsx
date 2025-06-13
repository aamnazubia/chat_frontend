import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

interface User {
  id: string;
  name: string;
  username: string;
}

interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

interface UserTyping {
  userId: string;
  userName: string;
  isTyping: boolean;
}

interface AuthResponse {
  success: boolean;
  message: string;
}

type AppView = 'login' | 'register' | 'chat';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [connected, setConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Auth state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');

  // Chat state
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<UserTyping[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to the socket server
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      setSocket(newSocket);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Handle auth responses
  useEffect(() => {
    if (!socket) return;

    socket.on('registerResponse', (response: AuthResponse) => {
      if (response.success) {
        setAuthSuccess('Registration successful! You can now log in.');
        setAuthError('');
        setTimeout(() => {
          setCurrentView('login');
          setAuthSuccess('');
        }, 2000);
      } else {
        setAuthError(response.message);
        setAuthSuccess('');
      }
    });

    socket.on('loginResponse', (response: AuthResponse) => {
      if (response.success) {
        setAuthSuccess('Login successful!');
        setAuthError('');
        setTimeout(() => {
          // Join the chat after login
          socket.emit('join', { username, name: name || username });
          setConnected(true);
          setCurrentView('chat');
          setAuthSuccess('');
        }, 1000);
      } else {
        setAuthError(response.message);
        setAuthSuccess('');
      }
    });

    return () => {
      socket.off('registerResponse');
      socket.off('loginResponse');
    };
  }, [socket, username, name]);

  // Setup chat socket event listeners once connected
  useEffect(() => {
    if (!socket || !connected) return;

    socket.on('userJoined', (user: User) => {
      setUsers(prevUsers => [...prevUsers, user]);
    });

    socket.on('userLeft', (userId: string) => {
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      setTypingUsers(prevTyping => prevTyping.filter(user => user.userId !== userId));
    });

    socket.on('userList', (userList: User[]) => {
      setUsers(userList);
    });

    socket.on('chatHistory', (history: Message[]) => {
      setMessages(history);
    });

    socket.on('newMessage', (newMsg: Message) => {
      setMessages(prevMsgs => [...prevMsgs, newMsg]);
    });

    socket.on('userTyping', (typingInfo: UserTyping) => {
      if (typingInfo.isTyping) {
        setTypingUsers(prevTyping => {
          // If user is already in typing list, don't add them again
          if (prevTyping.some(user => user.userId === typingInfo.userId)) {
            return prevTyping;
          }
          return [...prevTyping, typingInfo];
        });
      } else {
        setTypingUsers(prevTyping => 
          prevTyping.filter(user => user.userId !== typingInfo.userId)
        );
      }
    });

    return () => {
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('userList');
      socket.off('chatHistory');
      socket.off('newMessage');
      socket.off('userTyping');
    };
  }, [socket, connected]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    
    if (!username.trim() || !password.trim()) {
      setAuthError('Username and password are required');
      return;
    }
    
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    
    if (socket) {
      socket.emit('register', { username, password, name });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    
    if (!username.trim() || !password.trim()) {
      setAuthError('Username and password are required');
      return;
    }
    
    if (socket) {
      socket.emit('login', { username, password });
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    // Send typing indicator
    if (socket && connected) {
      socket.emit('typing', e.target.value.length > 0);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() && socket && connected) {
      socket.emit('sendMessage', message);
      setMessage('');
      // Clear typing indicator
      socket.emit('typing', false);
    }
  };

  // Render login view
  const renderLoginView = () => (
    <div className="auth-container">
      <h2>Login to Chat</h2>
      {authError && <div className="auth-error">{authError}</div>}
      {authSuccess && <div className="auth-success">{authSuccess}</div>}
      <form onSubmit={handleLogin} className="auth-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-button">Login</button>
      </form>
      <p className="auth-toggle">
        Don't have an account?{' '}
        <button onClick={() => setCurrentView('register')} className="text-button">
          Register here
        </button>
      </p>
    </div>
  );

  // Render register view
  const renderRegisterView = () => (
    <div className="auth-container">
      <h2>Create an Account</h2>
      {authError && <div className="auth-error">{authError}</div>}
      {authSuccess && <div className="auth-success">{authSuccess}</div>}
      <form onSubmit={handleRegister} className="auth-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="name">Display Name (optional)</label>
          <input
            type="text"
            id="name"
            placeholder="Enter your display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-button">Register</button>
      </form>
      <p className="auth-toggle">
        Already have an account?{' '}
        <button onClick={() => setCurrentView('login')} className="text-button">
          Login here
        </button>
      </p>
    </div>
  );

  // Render chat view
  const renderChatView = () => (
    <div className="chat-interface">
      <div className="chat-sidebar">
        <h2>Online Users ({users.length})</h2>
        <ul className="users-list">
          {users.map((user) => (
            <li key={user.id} className={user.id === socket?.id ? 'current-user' : ''}>
              {user.name} {user.id === socket?.id ? ' (You)' : ''}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="chat-main">
        <div className="messages-container">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.userId === socket?.id ? 'own-message' : 'other-message'}`}
            >
              <div className="message-header">
                <span className="message-author">
                  {msg.userId === socket?.id ? 'You' : msg.userName}
                </span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-text">{msg.text}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              {typingUsers.length === 1 
                ? `${typingUsers[0].userName} is typing...` 
                : `${typingUsers.length} people are typing...`}
            </div>
          )}
        </div>
        
        <form className="message-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={handleMessageChange}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <h1>Real-time Chat</h1>
      
      {currentView === 'login' && renderLoginView()}
      {currentView === 'register' && renderRegisterView()}
      {currentView === 'chat' && connected && renderChatView()}
    </div>
  );
}

export default App;
