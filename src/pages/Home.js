import { Linkedin, Instagram, Github } from "lucide-react"
import { Text, Box, Image } from "@chakra-ui/react"
import LiquidGlassBox from "../components/ui/LiquidGlassBox"
import "./Home.css"
import { useState } from "react"

export function Home() {

    const [songName, setSongName] = useState("")
    const [artistName, setArtistName] = useState("")
    const [imageUrl, setImageUrl] = useState("")
    const [songIsLoading, setSongIsLoading] = useState(true)

    useState(() => {
        const fetchSongData = async () => {
            setSongIsLoading(true)
            try {
                const response = await fetch("https://txz4mvpkqg.execute-api.us-east-2.amazonaws.com/dev/spotifyGetCurrentSong")
                const data = await response.json()
                console.log("Fetched song data:", data)
                setSongName(data.name)
                setArtistName(data.artists)
                setImageUrl(data.albumImage)
            } catch (error) {
                console.error("Error fetching song data:", error)
            } finally {
                setSongIsLoading(false)
            }
        }
        fetchSongData()
    }, [])

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
                    width="20%"
                    height="135px"
                    padding={2}
                    borderRadius="md"
                >
                    <Text fontSize="lg" fontWeight="bold" mb={2} ml={3} color={"secondary"}>
                        What's Playing?
                    </Text>
                    <Box
                        display="flex"
                        alignItems="flex-start"
                        ml={3}
                    >
                        <Image
                            src={imageUrl}
                            alt="Current Song"
                            boxSize="70px"
                            borderRadius="md"
                            objectFit="cover"
                            mb={4}
                            fallbackSrc="https://via.placeholder.com/200" // Placeholder image while loading
                        />
                        <Box ml={3}>
                            <Text fontWeight="bold" fontSize="lg">{songName}</Text>
                            <Text fontSize="sm">{artistName}</Text>
                        </Box>
                    </Box>
                </LiquidGlassBox>

                {/* Add extra content to enable scrolling */}
                <Box height="1200px" />
            </Box>
        </Box>
    )
}