import { createRoot } from 'react-dom/client'
import App from '../../src/App'
import '../../src/index.css'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
;(window as unknown as Window & { unmountTodo: () => void }).unmountTodo = () => root.unmount()
