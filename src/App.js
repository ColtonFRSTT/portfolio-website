import { ColorModeProvider } from "./components/ui/color-mode"
import { ChakraProvider } from "@chakra-ui/react"
import { Home } from "./pages/Home"
import system from "./theme/theme"

function App({ pageProps }) {
  return (
    <ChakraProvider value = {system}>
      <ColorModeProvider>
        <Home {...pageProps} />
      </ColorModeProvider>
    </ChakraProvider>
  )
}

export default App