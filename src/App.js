import { ColorModeProvider } from "./components/ui/color-mode"
import { ChakraProvider, Box, Text } from "@chakra-ui/react"
import { Home } from "./pages/Home"
import system from "./theme/theme"
import { useEffect, useState } from "react"

function MobileBlocker() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bg="#060e1f"
      px={6}
      textAlign="center"
    >
      <Text
        fontSize="4xl"
        fontWeight="bold"
        color="#483AA0"
        textShadow="0 0 20px rgba(72, 58, 160, 0.8)"
        mb={4}
      >
        📱
      </Text>
      <Text
        fontSize="xl"
        fontWeight="bold"
        color="white"
        textShadow="0 0 8px #483AA0"
        mb={2}
      >
        Desktop Only
      </Text>
      <Text
        fontSize="md"
        color="gray.400"
        textShadow="0 0 8px #483AA0"
      >
        Please visit this site on a desktop browser for the best experience.
      </Text>
    </Box>
  )
}

function App({ pageProps }) {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
      const isMobileDevice = mobileRegex.test(userAgent.toLowerCase())
      const isSmallScreen = window.innerWidth < 768
      setIsMobile(isMobileDevice || isSmallScreen)
      setIsLoaded(true)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isLoaded) {
    return (
      <ChakraProvider value={system}>
        <Box minHeight="100vh" bg="#060e1f" />
      </ChakraProvider>
    )
  }

  if (isMobile) {
    return (
      <ChakraProvider value={system}>
        <MobileBlocker />
      </ChakraProvider>
    )
  }

  return (
    <ChakraProvider value={system}>
      <ColorModeProvider>
        <Home {...pageProps} />
      </ColorModeProvider>
    </ChakraProvider>
  )
}

export default App