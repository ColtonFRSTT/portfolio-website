import { Linkedin, Instagram, Github, Music4 } from "lucide-react"
import { Text, Box, Image, Progress } from "@chakra-ui/react"
import LiquidGlassBox from "../components/ui/LiquidGlassBox"
import "./Home.css"
import { useState, useRef } from "react"
import { Spinner } from "@chakra-ui/react"

function msToMinutesSeconds(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function Home() {

    const [songName, setSongName] = useState("")
    const [artistName, setArtistName] = useState("")
    const [imageUrl, setImageUrl] = useState("")
    const [songIsLoading, setSongIsLoading] = useState(true)
    const [songDuration, setSongDuration] = useState(0)
    const [songProgress, setSongProgress] = useState(0)

    const retryCount = useRef(0)
    const maxRetries = 5

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
                setSongDuration(data.durationMs)
                setSongProgress(data.progressMs)
                retryCount.current = 0
            } catch (error) {
                if (retryCount.current < maxRetries) {
                    retryCount.current += 1
                    console.error("Error fetching song data refreshing tokns:", error)
                    const refreshResponse = await fetch("https://txz4mvpkqg.execute-api.us-east-2.amazonaws.com/dev/spotifyRefresh")
                    const data = await refreshResponse.json()
                    console.log("response from refresh: ", data)
                    fetchSongData()
                } else {
                    console.error("Max retries reached")
                }
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
                    height="40px"
                    alignItems="center"
                    marginLeft="30px"
                >
                    <Text textShadow="0 0 8px #483AA0" fontSize={"lg"} marginLeft={2} color="secondary"> Home </Text>
                    <Text textShadow="0 0 8px #483AA0" fontSize={"lg"} marginRight={2} color="secondary"> Projects </Text>
                </LiquidGlassBox>
                <LiquidGlassBox
                    marginRight="30px"
                    display="flex"
                    height = "40px"
                    justifyContent="space-between"
                    gap={6}
                    alignItems="center"
                >
                    <Box my={1} marginLeft={2}><Github style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="1.25rem" /></Box>
                    <Box my={1}><Linkedin style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="1.25rem" /></Box>
                    <Box my={1} marginRight={2}><Instagram style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="1.25rem" /></Box>
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
                <Box
                    display = "flex"
                    flexDirection = "column"
                    width = "800px"
                    height = "300px"
                >
                    <Text textShadow="0 0 8px #483AA0" fontSize = "xxl" fontWeight = "Bold" color="secondary"> Welcome! </Text>
                </Box>
                <Box
                    display="flex"
                    flexDirection="column"
                    position="fixed"
                    bottom="32px"
                    right="32px"
                    zIndex={20}
                >
                    <LiquidGlassBox
                        className="liquid-glass"
                        display="flex"
                        flexDirection="column"
                        padding={4}
                        borderRadius="md"
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            mb={3}
                        >
                            <Music4 style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color = "#483AA0"></Music4>
                            <Text textShadow="0 0 8px #483AA0" color = "secondary" ml={2} mr={2} fontSize={"lg"} fontWeight={"Bold"}>Now Playing</Text>
                            <Music4 style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color = "#483AA0"></Music4>
                        </Box>

                        {(songIsLoading) && (
                            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
                                <Spinner color = "secondary"></Spinner>
                            </Box>
                        )}
                        {(!songIsLoading) && (
                            <>
                            <Box
                                display="flex"
                                alignItems="flex-start"
                            >
                                <Image
                                    src={imageUrl}
                                    alt="Current Song"
                                    boxSize="90px"
                                    borderRadius="md"
                                    objectFit="cover"
                                    fallbackSrc="https://via.placeholder.com/200" // Placeholder image while loading
                                />
                                <Box ml={3}>
                                    <Text fontWeight="bold" fontSize="md">{songName}</Text>
                                    <Text fontSize="sm"> By: {artistName}</Text>
                                    <Progress.Root max = {songDuration} min={0} value={songProgress} shape={"rounded"} size = {"sm"} mt={2}>
                                        <Progress.Track>
                                            <Progress.Range/>
                                        </Progress.Track>
                                    </Progress.Root>
                                    <Box
                                        display="flex"
                                        gap="230px"
                                    >
                                        <Text fontSize={"xs"}>{msToMinutesSeconds(songProgress)}</Text>
                                        <Text fontSize={"xs"}>{msToMinutesSeconds(songDuration)}</Text>
                                    </Box>
                                </Box>
                            </Box>
                            </>
                        )}
                    </LiquidGlassBox>
                    <Box display="flex" justifyContent="flex-end">
                        <Text color = "secondary" fontSize="xs">Powered By Spotify</Text>
                    </Box>
                </Box>

                {/* Add extra content to enable scrolling */}
                <Box height="1200px" />
            </Box>
        </Box>
    )
}