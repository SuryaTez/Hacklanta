from http.server import SimpleHTTPRequestHandler, HTTPServer
import os
os.chdir(os.path.join(os.path.dirname(__file__),'dist'))
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if not os.path.isfile(self.path.split('?')[0].lstrip('/')) and not '.' in self.path.split('/')[-1]: self.path='/index.html'
  super().do_GET()
HTTPServer(('127.0.0.1',3000),Handler).serve_forever()
