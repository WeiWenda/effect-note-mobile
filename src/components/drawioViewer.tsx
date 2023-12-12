import React from 'react';
import Session from "../ts/session";
import Row from "../ts/path";

type DrawioViewerProps = {
  content: string;
  session: Session;
  row: Row;
};

export class DrawioViewer extends React.Component<DrawioViewerProps, {zoom: number}>  {

  constructor(props: DrawioViewerProps) {
    super(props);
    this.state ={
      zoom: 1
    }
  }

  zoomIn() {
    this.setState({
      zoom: this.state.zoom + 0.3
    })
  }

  zoomOut() {
    this.setState({
      zoom: this.state.zoom - 0.3
    })
  }

  render() {
    const div = document.createElement('div')
    div.className = 'mxgraph'
    div.dataset.mxgraph = JSON.stringify({
      highlight: this.props.session.clientStore.getClientSetting('theme-bg-highlight'),
      lightbox: false,
      edit: '_blank',
      zoom: this.state.zoom,
      nav: true,
      xml: this.props.content,
    })
    const iframeContent =
        `<body>
          ${div.outerHTML.replaceAll(/"/g, '\'')}
          <script type='text/javascript' src='/drawio/js/viewer-static.min.js'></script>
        </body>`
    const iframe = '<iframe id="drawioViewIfr" onload="resizeIframe(this,' + this.props.row + ')" class="drawio-viewer" srcDoc="' + iframeContent + '"'
      + ' frameborder="0" ></iframe>';
    return (
      <div dangerouslySetInnerHTML={{__html: iframe}} />
    );
  }
}
