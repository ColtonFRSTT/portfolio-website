import { Linkedin, Instagram, Github } from "lucide-react"
import { Text, Box } from "@chakra-ui/react"
import LiquidGlassBox from "../components/ui/LiquidGlassBox"
import "./Home.css"

export function Home() {
    return (
        <Box
            minHeight="100vh"
            bgImage="url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80')"
            bgSize="cover"
            bgPosition="center"
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
                    className="liquid-glass"
                    display="flex"
                    justifyContent="space-between"
                    gap={10}
                    alignItems="center"
                    marginLeft="30px"
                    fontSize="lg"
                >
                    <Text marginLeft={2} color="primary"> Home </Text>
                    <Text marginRight={2} color="primary"> Projects </Text>
                </LiquidGlassBox>
                <LiquidGlassBox
                    className="liquid-glass"
                    marginRight="30px"
                    display="flex"
                    justifyContent="space-between"
                    gap={6}
                    alignItems="center"
                >
                    <Box my={1} marginLeft={2}><Github color="#7965C1" size="1.25rem" /></Box>
                    <Box my={1}><Linkedin color="#7965C1" size="1.25rem" /></Box>
                    <Box my={1} marginRight={2}><Instagram color="#7965C1" size="1.25rem" /></Box>
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
                <Box className="welcome-note">
                    <Text color="primary" fontSize="xl" fontWeight="bold">
                        I'm Colton. Welcome to my website!
                    </Text>
                </Box>
                {/* Add extra content to enable scrolling */}
                <Box height="1200px" />
            </Box>
        </Box>
    )
}