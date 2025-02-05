async function drawGraph(baseUrl, isHome, pathColors, graphConfig, pageRelPermalink = null) {

  let {
    depth,
    enableDrag,
    enableLegend,
    enableZoom,
    opacityScale,
    scale,
    repelForce,
    linkDistance,
    distanceMax,
    linkStrength,
    centerForce,
    fontSize
  } = graphConfig;

  console.log(graphConfig);

  const containerId = isHome ? "graph-container-global" : "graph-container-local";
  const container = document.getElementById(containerId);
  if (!container) return;

  const { index, links, content } = await fetchData

  // Use .pathname to remove hashes / searchParams / text fragments
  const cleanUrl = window.location.origin + window.location.pathname
  console.log("cleanUrl " + cleanUrl)
  console.log("baseUrl " + baseUrl)

  const curPage = pageRelPermalink ? pageRelPermalink.replace(/\/$/g, "") : cleanUrl.replace(/\/$/g, "").replace(baseUrl, "") // use one passed by Hugo instead. Fixes netlify case insensitivity.
  console.log("curPage " + curPage)

  const parseIdsFromLinks = (links) => [
    ...new Set(links.flatMap((link) => [link.source, link.target])),
  ]

  // Links is mutated by d3. We want to use links later on, so we make a copy and pass that one to d3
  // Note: shallow cloning does not work because it copies over references from the original array
  const copyLinks = JSON.parse(JSON.stringify(links))
  console.log(copyLinks)

  const neighbours = new Set()
  const wl = [curPage || "/", "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbours.add(cur)
        // Get both outgoing and incoming links
        const outgoing = index.links[cur] || []
        const incoming = index.backlinks[cur] || []
        
        // Process outgoing links
        outgoing.forEach(link => {
          wl.push(link)
          // Add both source and target to create the connection
          copyLinks.push({
            source: cur,
            target: link
          })
        })
        
        // Process incoming links
        incoming.forEach(link => {
          wl.push(link)
          // Add both source and target to create the connection
          copyLinks.push({
            source: link,
            target: cur
          })
        })
      }
    }
  } else {
    parseIdsFromLinks(copyLinks).forEach((id) => neighbours.add(id))
  }

  // Remove duplicates from links
  const uniqueLinks = Array.from(new Set(copyLinks.map(JSON.stringify))).map(JSON.parse)

  const data = {
    nodes: [...neighbours].map((id) => ({ id })),
    links: uniqueLinks.filter((l) => neighbours.has(l.source) && neighbours.has(l.target)),
  }

  const color = (d) => {
    if (d.id === curPage || (d.id === "/" && curPage === "")) {
      return "var(--g-node-active)"
    }

    for (const pathColor of pathColors) {
      const path = Object.keys(pathColor)[0]
      const colour = pathColor[path]
      if (d.id.startsWith(path)) {
        return colour
      }
    }

    return "var(--g-node)"
  }

  const drag = (simulation) => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(1).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event, d) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    const noop = () => {}
    return d3
      .drag()
      .on("start", enableDrag ? dragstarted : noop)
      .on("drag", enableDrag ? dragged : noop)
      .on("end", enableDrag ? dragended : noop)
  }

  const height = Math.max(container.offsetHeight, isHome ? 500 : 250)
  const width = container.offsetWidth

  const simulation = d3
    .forceSimulation(data.nodes)
    .force("charge", 
      d3
        .forceManyBody()
        .strength(-40)
        .distanceMax(distanceMax)
        .distanceMin(0.01)
    )
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance(linkDistance)
        .strength(linkStrength)
    )
    .force("center", d3.forceCenter().strength(centerForce))

  const svg = d3
    .select(`#${containerId}`)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr('viewBox', [-width / 2 * 1 / scale, -height / 2 * 1 / scale, width * 1 / scale, height * 1 / scale])

  if (enableLegend) {
    const legend = [{ Current: "var(--g-node-active)" }, { Note: "var(--g-node)" }, ...pathColors]
    legend.forEach((legendEntry, i) => {
      const key = Object.keys(legendEntry)[0]
      const colour = legendEntry[key]
      svg
        .append("circle")
        .attr("cx", -width / 2 + 20)
        .attr("cy", height / 2 - 30 * (i + 1))
        .attr("r", 6)
        .style("fill", colour)
      svg
        .append("text")
        .attr("x", -width / 2 + 40)
        .attr("y", height / 2 - 30 * (i + 1))
        .text(key)
        .style("font-size", "15px")
        .attr("alignment-baseline", "middle")
    })
  }

  // draw links between nodes
  const link = svg
    .append("g")
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("class", "link")
    .attr("stroke", "var(--g-link)")
    .attr("stroke-width", 1)
    .attr("data-source", (d) => d.source.id)
    .attr("data-target", (d) => d.target.id)

  // svg groups
  const graphNode = svg.append("g").selectAll("g").data(data.nodes).enter().append("g")

  // calculate radius
  const nodeRadius = (d) => {
    if (d.id === "/") return 4;
    const numOut = index.links[d.id]?.length || 0
    const numIn = index.backlinks[d.id]?.length || 0
    return (2 + Math.log(numOut + numIn + 1) * 0.6)
  }

  // draw individual nodes
  const node = graphNode
    .append("circle")
    .attr("class", "node")
    .attr("id", (d) => d.id)
    .attr("r", nodeRadius)
    .attr("fill", color)
    .style("cursor", "pointer")
    .on("click", (_, d) => {
      // SPA navigation
      window.Million.navigate(new URL(`${baseUrl}${decodeURI(d.id).replace(/\s+/g, "-")}/`), ".singlePage")
    })
    .on("mouseover", function (_, d) {
      // Only dim non-connected nodes
      const neighbours = parseIdsFromLinks([
        ...(index.links[d.id] || []),
        ...(index.backlinks[d.id] || []),
      ])
      neighbours.push(d.id) // Include current node
      
      d3.selectAll(".node")
        .transition()
        .duration(100)
        .attr("fill", n => neighbours.includes(n.id) ? color(n) : "var(--g-node-inactive)")
        .attr("r", n => neighbours.includes(n.id) ? nodeRadius(n) * 1.2 : nodeRadius(n))

      window.Million.prefetch(new URL(`${baseUrl}${decodeURI(d.id).replace(/\s+/g, "-")}/`))
      const currentId = d.id
      const linkNodes = d3
        .selectAll(".link")
        .filter((d) => d.source.id === currentId || d.target.id === currentId)

      // highlight links
      linkNodes.transition().duration(200).attr("stroke", "var(--g-link-active)")

      const bigFont = fontSize*1.3

      // show text for self
      d3.select(this.parentNode)
        .raise()
        .select("text")
        .transition()
        .duration(200)
        .attr('opacityOld', d3.select(this.parentNode).select('text').style("opacity"))
        .style('opacity', 1)
        .style('font-size', bigFont+'em')
        .attr('dy', d => nodeRadius(d) + 10 + 'px')
    })
    .on("mouseleave", function (_, d) {
      // Restore all nodes
      d3.selectAll(".node")
        .transition()
        .duration(200)
        .attr("fill", color)
        .attr("r", nodeRadius)

      const currentId = d.id
      const linkNodes = d3
        .selectAll(".link")
        .filter((d) => d.source.id === currentId || d.target.id === currentId)

      linkNodes.transition().duration(200).attr("stroke", "var(--g-link)")

      d3.select(this.parentNode)
        .select("text")
        .transition()
        .duration(200)
        .style('opacity', d3.select(this.parentNode).select('text').attr("opacityOld"))
        .style('font-size', fontSize+'em')
        .attr('dy', d => nodeRadius(d) + 8 + 'px')
    })
    .call(drag(simulation))

  // draw labels
  const labels = graphNode
    .append("text")
    .attr("dx", 0)
    .attr("dy", (d) => nodeRadius(d) + 8 + "px")
    .attr("text-anchor", "middle")
    .text((d) => content[d.id]?.title || d.id.replace("-", " "))
    .style('opacity', (opacityScale - 1) / 3.75)
    .style("pointer-events", "none")
    .style('font-size', fontSize+'em')
    .raise()
    .call(drag(simulation))

  // set panning

  if (enableZoom) {
    svg.call(
      d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          link.attr("transform", transform)
          node.attr("transform", transform)
          const scale = transform.k * opacityScale;
          const scaledOpacity = Math.max((scale - 1) / 3.75, 0)
          labels.attr("transform", transform).style("opacity", scaledOpacity)
        }),
    )
  }

  // progress the simulation
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y)
    labels.attr("x", (d) => d.x).attr("y", (d) => d.y)
  })
}
