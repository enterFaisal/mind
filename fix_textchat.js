const fs = require('fs');

const content = fs.readFileSync('frontend/src/pages/TextChat.jsx', 'utf8');

// There was a logic error when I copied handleSend (it sets error message every time after success)
const fix1 = content.replace(
  `} catch (error) {\n      console.error('Chat error:', error);\n      const errorMessage = {\n        id: Date.now() + 1,\n        sender: 'bot',\n        text: "I'm having trouble connecting right now. Let's take a deep breath and try again in a moment.",\n        timestamp: 'Just now'\n      };\n      setMessages(prev => [...prev, errorMessage]);\n    } finally {\n      setIsLoading(false);\n    }`,
  `} catch (error) {\n      console.error('Chat error:', error);\n      const errorMessage = {\n        id: Date.now() + 1,\n        sender: 'bot',\n        text: "I'm having trouble connecting right now. Let's take a deep breath and try again in a moment.",\n        timestamp: 'Just now'\n      };\n      setMessages(prev => [...prev, errorMessage]);\n    } finally {\n      setIsLoading(false);\n    }`
);

fs.writeFileSync('frontend/src/pages/TextChat.jsx', fix1);
