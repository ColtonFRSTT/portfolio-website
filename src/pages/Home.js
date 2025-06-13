import { Linkedin, Instagram, Github } from "lucide-react"
import { Text, Box } from "@chakra-ui/react"
import LiquidGlassBox from "../components/ui/LiquidGlassBox"
import "./Home.css"

export function Home() {
    return (
        <Box
            minHeight="100vh"
            className = "background"
        >
            <Box
                className="header"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                fontWeight="bold"
                height="64px"
                position="sticky"
                top="0"
                zIndex="10"
            >
                <LiquidGlassBox
                    display="flex"
                    justifyContent="space-between"
                    gap={10}
                    alignItems="center"
                    marginLeft="30px"
                    fontSize="lg"
                >
                    <Text marginLeft={2} color="secondary"> Home </Text>
                    <Text marginRight={2} color="secondary"> Projects </Text>
                </LiquidGlassBox>
                <LiquidGlassBox
                    marginRight="30px"
                    display="flex"
                    justifyContent="space-between"
                    gap={6}
                    alignItems="center"
                >
                    <Box my={1} marginLeft={2}><Github color="#483AA0" size="1.25rem" /></Box>
                    <Box my={1}><Linkedin color="#483AA0" size="1.25rem" /></Box>
                    <Box my={1} marginRight={2}><Instagram color="#483AA0" size="1.25rem" /></Box>
                </LiquidGlassBox>
            </Box>
            <Box
                className="content"
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                minHeight="calc(100vh - 64px)"
                bg="transparent"
                pt={10}
                pb={10}
            >
                <LiquidGlassBox
                    className="liquid-glass"
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    width="80%"
                    maxWidth="800px"
                    padding={8}
                    borderRadius="md"
                >

                </LiquidGlassBox>
                
                {/* Add extra content to enable scrolling */}
                <Box height="1200px" />
            </Box>
        </Box>
    )
}